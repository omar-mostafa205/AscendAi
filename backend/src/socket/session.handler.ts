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

const activeSocketIdBySessionUserKey = new Map<string, string>()
const disconnectTimersBySessionId = new Map<string, NodeJS.Timeout>()

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
      return
    }

    const trimmedContent = content.trim()
    
    if (trimmedContent.length > 8000) {
      logger.warn("Message too long", { sessionId, userId, length: trimmedContent.length })
      return
    }

    try {
      const session = await prisma.interviewSession.findFirst({
        where: { id: sessionId, userId },
        select: { id: true, status: true },
      })

      if (!session) {
        logger.warn("save_message: session not found", { sessionId, userId })
        return
      }

      if (session.status !== "active" && session.status !== "in_progress") {
        logger.warn("save_message: session not active", { sessionId, userId, status: session.status })
        return
      }

      const existingMessage = await prisma.interviewMessage.findFirst({
        where: {
          sessionId,
          role,
          content: trimmedContent,
          createdAt: {
            gte: new Date(Date.now() - 5000)
          }
        },
      })

      if (existingMessage) {
        logger.debug("Duplicate message ignored", { sessionId, role })
        return
      }

      await prisma.interviewMessage.create({
        data: { 
          sessionId, 
          role, 
          content: trimmedContent 
        },
      })
      
      logger.debug("Message saved", { sessionId, role, length: trimmedContent.length })
    } catch (error) {
      Sentry.captureException(error)
      logger.error("save_message error", { sessionId, userId, role, error })
    }
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
            select: { id: true, status: true },
          })

          if (!session) return
          
          if (session.status !== "in_progress" && session.status !== "active") {
            logger.debug("Session not active, skipping auto-end", { sessionId, status: session.status })
            return
          }

          const userMsgCount = await prisma.interviewMessage.count({
            where: { sessionId, role: "user" },
          })

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