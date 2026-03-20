import { prisma } from "../config/database"
import logger from "../config/logger"
import { analysisQueue } from "../queues/session-analysis-queue"
import * as Sentry from "@sentry/node"
import { Server, Socket } from "socket.io"

type JoinPayload = string | { sessionId: string }

type SaveMessagePayload = {
  sessionId: string
  role: "user" | "assistant"
  content: string
}

type SessionMessage = {
  role: "user" | "assistant"
  content: string
  createdAt: string
}

const activeSocketIdBySessionUserKey = new Map<string, string>()
const disconnectTimersBySessionId = new Map<string, NodeJS.Timeout>()
const pendingMessagesBySessionId = new Map<string, SessionMessage[]>()
const flushTimersBySessionId = new Map<string, NodeJS.Timeout>()

function clearDisconnectTimer(sessionId: string) {
  const timer = disconnectTimersBySessionId.get(sessionId)
  if (timer) {
    clearTimeout(timer)
    disconnectTimersBySessionId.delete(sessionId)
  }
}

export const registerSessionHandlers = (io: Server, socket: Socket) => {
  const userId = socket.data.userId as string
  const joinedSessionIds = new Set<string>()

  const flushPendingMessages = async (sessionId: string) => {
    const pending = pendingMessagesBySessionId.get(sessionId)
    if (!pending || pending.length === 0) return
  
    pendingMessagesBySessionId.delete(sessionId)
  
    const t = flushTimersBySessionId.get(sessionId)
    if (t) {
      clearTimeout(t)
      flushTimersBySessionId.delete(sessionId)
    }
  
    try {
      const session = await prisma.interviewSession.findFirst({
        where: { id: sessionId, userId },
        select: { id: true, status: true, messages: true },
      })
  
      if (!session) {
        logger.warn("flushPendingMessages: session not found", { sessionId, userId })
        return
      }
  
      const existingUnknown: unknown = session.messages
      const existing: SessionMessage[] = Array.isArray(existingUnknown)
        ? (existingUnknown as SessionMessage[])
        : []
  
      const merged: SessionMessage[] = [...existing]
  
      for (const m of pending) {
        const isDuplicate = merged.some(
          (msg) => msg.role === m.role && msg.content === m.content
        )
        if (!isDuplicate) {
          merged.push(m)
        }
      }
  
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { 
          messages: merged 
        },
      })
  
      logger.debug("Messages flushed to session.messages", { 
        sessionId, 
        userId, 
        totalMessages: merged.length,
        added: merged.length - existing.length 
      })
    } catch (error) {
      Sentry.captureException(error)
      logger.error("flushPendingMessages error", { sessionId, userId, error })
      throw error
    }
  }
  const enqueueMessage = (sessionId: string, message: SessionMessage) => {
    const pending = pendingMessagesBySessionId.get(sessionId) ?? []
    pending.push(message)
    pendingMessagesBySessionId.set(sessionId, pending)

    if (flushTimersBySessionId.has(sessionId)) return

    const timer = setTimeout(() => {
      flushPendingMessages(sessionId).catch((error) => {
        Sentry.captureException(error)
        logger.error("flushPendingMessages error", { sessionId, userId, error })
      })
    }, 800)

    flushTimersBySessionId.set(sessionId, timer)
  }

  socket.on("join_session", async (payload: JoinPayload) => {
    const sessionId = typeof payload === "string" ? payload : payload?.sessionId
    
    if (!sessionId) {
      socket.emit("error", { message: "Missing sessionId" })
      return
    }

    try {
      clearDisconnectTimer(sessionId)

      const session = await prisma.interviewSession.findFirst({
        where: { id: sessionId, userId },
        select: { id: true, status: true },
      })

      if (!session) {
        socket.emit("error", { message: "Session not found or access denied" })
        return
      }

      if (session.status === "completed" || session.status === "processing") {
        socket.emit("error", { message: "Session already ended" })
        return
      }

      if (joinedSessionIds.has(sessionId)) {
        socket.join(sessionId)
        socket.emit("session_joined", { sessionId })
        return
      }

      const sessionUserKey = `${sessionId}:${userId}`
      const existingSocketId = activeSocketIdBySessionUserKey.get(sessionUserKey)
      
      if (existingSocketId && existingSocketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existingSocketId)
        if (oldSocket) {
          oldSocket.leave(sessionId)
          oldSocket.disconnect(true)
        }
      }
      
      activeSocketIdBySessionUserKey.set(sessionUserKey, socket.id)

      socket.join(sessionId)
      joinedSessionIds.add(sessionId)
      
      logger.info("User joined session", { 
        service: "AscendAI", 
        sessionId, 
        userId 
      })
      
      socket.emit("session_joined", { sessionId })
    } catch (error) {
      Sentry.captureException(error)
      logger.error("join_session error", { error, sessionId, userId })
      socket.emit("error", { message: "Failed to join session" })
    }
  })

  socket.on("save_message", async (payload: SaveMessagePayload) => {
    const { sessionId, role, content } = payload || {}
    
    if (!sessionId || !role || !content?.trim()) {
      logger.debug("save_message: ignored empty payload", { sessionId, userId, role })
      return
    }

    const trimmedContent = content.trim()
    
    if (trimmedContent.length > 8000) {
      logger.warn("Message too long", { sessionId, userId, length: trimmedContent.length })
      return
    }

    enqueueMessage(sessionId, {
      role,
      content: trimmedContent,
      createdAt: new Date().toISOString(),
    })
  })

  socket.on("end_session", async ({ sessionId }: { sessionId: string }) => {
    if (!sessionId) {
      socket.emit("error", { message: "Missing sessionId" })
      return
    }

    try {
      const session = await prisma.interviewSession.findFirst({
        where: { id: sessionId, userId },
        select: { id: true, status: true },
      })

      if (!session) {
        socket.emit("error", { message: "Session not found or access denied" })
        return
      }

      if (session.status === "completed" || session.status === "processing") {
        socket.emit("error", { message: "Session already ended" })
        return
      }

      // Ensure the full conversation is persisted before ending the session.
      await flushPendingMessages(sessionId)

      await prisma.interviewSession.updateMany({
        where: { id: sessionId, userId },
        data: { 
          status: "processing", 
          endedAt: new Date() 
        },
      })
      await flushPendingMessages(sessionId)

      try {
        await analysisQueue.add("analyze_session", { sessionId })
      } catch (queueError) {
        Sentry.captureException(queueError)
        logger.error("Failed to enqueue analysis job", { sessionId, userId, error: queueError })
      }

      io.to(sessionId).emit("session_ended", { sessionId })
      socket.leave(sessionId)
      joinedSessionIds.delete(sessionId)

      const sessionUserKey = `${sessionId}:${userId}`
      if (activeSocketIdBySessionUserKey.get(sessionUserKey) === socket.id) {
        activeSocketIdBySessionUserKey.delete(sessionUserKey)
      }

      logger.info("Session ended, feedback job enqueued", { 
        service: "AscendAI", 
        sessionId, 
        userId 
      })
    } catch (error) {
      Sentry.captureException(error)
      logger.error("end_session error", { error, sessionId, userId })
      socket.emit("error", { message: "Failed to end session" })
    }
  })

  socket.on("leave_session", (sessionId: string) => {
    if (!sessionId) return

    socket.leave(sessionId)
    joinedSessionIds.delete(sessionId)
    
    const sessionUserKey = `${sessionId}:${userId}`
    if (activeSocketIdBySessionUserKey.get(sessionUserKey) === socket.id) {
      activeSocketIdBySessionUserKey.delete(sessionUserKey)
    }
    
    logger.info("User left session", { 
      service: "AscendAI", 
      sessionId, 
      socketId: socket.id, 
      userId 
    })
  })

  socket.on("disconnect", async (reason) => {
    if (joinedSessionIds.size === 0) return

    for (const sessionId of joinedSessionIds) {
      const sessionUserKey = `${sessionId}:${userId}`
      
      if (activeSocketIdBySessionUserKey.get(sessionUserKey) === socket.id) {
        activeSocketIdBySessionUserKey.delete(sessionUserKey)
      }

      clearDisconnectTimer(sessionId)
      
      const timer = setTimeout(async () => {
        try {
          const roomSize = io.sockets.adapter.rooms.get(sessionId)?.size ?? 0
          if (roomSize > 0) {
            logger.debug("Session still has active connections", { sessionId, roomSize })
            return
          }

          const session = await prisma.interviewSession.findFirst({
            where: { id: sessionId, userId },
            select: { id: true, status: true, messages: true },
          })

          if (!session) return
          
          if (session.status !== "in_progress" && session.status !== "active") {
            logger.debug("Session not active, skipping auto-end", { sessionId, status: session.status })
            return
          }

          await flushPendingMessages(sessionId)

          const refreshed = await prisma.interviewSession.findFirst({
            where: { id: sessionId, userId },
            select: { messages: true },
          })
          const messages = Array.isArray(refreshed?.messages) ? (refreshed?.messages as any[]) : []
          const userMsgCount = messages.filter((m) => m?.role === "user" && String(m?.content ?? "").trim().length > 0).length

          if (userMsgCount === 0) {
            logger.debug("No user messages, skipping auto-end", { sessionId })
            return
          }

          await prisma.interviewSession.updateMany({
            where: { id: sessionId, userId },
            data: { 
              status: "processing", 
              endedAt: new Date() 
            },
          })

          try {
            await analysisQueue.add("analyze_session", { sessionId })
          } catch (queueError) {
            logger.error("Failed to enqueue analysis on disconnect", { 
              sessionId, 
              userId, 
              error: queueError 
            })
          }

          io.to(sessionId).emit("session_ended", { sessionId })
          
          logger.info("Session ended on disconnect", { 
            service: "AscendAI", 
            sessionId, 
            userId, 
            reason 
          })
        } catch (error) {
          Sentry.captureException(error)
          logger.error("Failed to end session on disconnect", { 
            sessionId, 
            userId, 
            reason, 
            error 
          })
        } finally {
          disconnectTimersBySessionId.delete(sessionId)
        }
      }, 5000)

      disconnectTimersBySessionId.set(sessionId, timer)
    }

    joinedSessionIds.clear()
  })
}
