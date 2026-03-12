import { prisma } from "../config/database"
import logger from "../config/logger"
import { analysisQueue } from "../queues/session-analysis-queue"
import createInterviewGraph from "../services/ai/graphs/interview-graph"
import { deepgramService } from "../services/voice/deepgram.service"
import * as Sentry from "@sentry/node"
import { HumanMessage } from "@langchain/core/messages"
import { Server, Socket } from "socket.io"

type JoinPayload = string | { sessionId: string }

type UserAnswerPayload = {
  sessionId: string
  audioBuffer: any
  mimeType?: string
}

// Prevent overlapping processing for the same session (which can cause repeated questions).
const inFlightBySessionId = new Set<string>()
const pendingBySessionId = new Map<string, UserAnswerPayload>()
let graphInstance: Awaited<ReturnType<typeof createInterviewGraph>> | null = null

async function getGraph() {
  if (!graphInstance) graphInstance = await createInterviewGraph()
  return graphInstance
}

function sanitizeAudioContentType(mimeType: unknown): string {
  if (typeof mimeType !== "string") return "audio/webm"
  const v = mimeType.trim().toLowerCase()
  if (!v || !v.startsWith("audio/")) return "audio/webm"
  // Keep codecs if present; Deepgram can use it, and stripping it can hurt for some browsers.
  return v
}

function normalizeToBuffer(raw: any): Buffer {
  if (!raw) return Buffer.alloc(0)
  if (Buffer.isBuffer(raw)) return raw
  if (raw instanceof ArrayBuffer) return Buffer.from(new Uint8Array(raw))
  // socket.io can sometimes send { type: "Buffer", data: number[] }
  if (raw?.type === "Buffer" && Array.isArray(raw.data)) return Buffer.from(raw.data)
  if (raw?.data && Array.isArray(raw.data)) return Buffer.from(raw.data)
  if (Array.isArray(raw)) return Buffer.from(raw)
  if (ArrayBuffer.isView(raw)) return Buffer.from(raw as any)
  return Buffer.from(raw as any)
}

export const registerSessionHandlers = (io: Server, socket: Socket) => {
  const userId = socket.data.userId as string

  socket.on("join_session", async (payload: JoinPayload) => {
    const sessionId = typeof payload === "string" ? payload : payload?.sessionId
    if (!sessionId) {
      socket.emit("error", { message: "Missing sessionId" })
      return
    }

    try {
      const session = await prisma.interviewSession.findFirst({
        where: { id: sessionId, userId },
        include: { persona: true, job: true },
      })
      if (!session) {
        socket.emit("error", { message: "Session not found or access denied" })
        return
      }

      socket.join(sessionId)
      logger.info("User joined session", { sessionId, userId })

      socket.emit("session_joined", { sessionId })
    } catch (error) {
      Sentry.captureException(error)
      logger.error("join_session error", { error, sessionId, userId })
      socket.emit("error", { message: "Failed to join session" })
    }
  })

  const processUserAnswer = async ({ sessionId, audioBuffer, mimeType }: UserAnswerPayload) => {
    if (!sessionId) {
      socket.emit("error", { message: "Missing sessionId" })
      return
    }

    socket.emit("ai_thinking")

    const audio = normalizeToBuffer(audioBuffer)
    logger.info("user_answer received", {
      sessionId,
      userId,
      rawType: typeof audioBuffer,
      audioBytes: audio.length,
      mimeType,
    })

    // Ignore tiny blobs that commonly occur from accidental clicks or VAD tail.
    // These often fail STT ("corrupt or unsupported data") and cause the AI to repeat questions.
    const MIN_AUDIO_BYTES = 200
    if (audio.length > 0 && audio.length < MIN_AUDIO_BYTES) {
      logger.info("Dropping tiny audio blob", { sessionId, userId, audioBytes: audio.length })
      return
    }

    const session = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId },
      include: { persona: true, job: true },
    })
    if (!session) {
      socket.emit("error", { message: "Session not found or access denied" })
      return
    }

    let transcript = ""
    if (audio.length) {
      const contentType = sanitizeAudioContentType(mimeType)
      transcript = await deepgramService.transcribeAudio(audio, contentType)
    }

    if (!transcript?.trim() && audio.length) {
      socket.emit("ai_response", {
        text: "I couldn't hear that clearly. Please repeat your answer (or speak a bit louder).",
        audio: null,
      })
      return
    }

    logger.info("Received user answer", {
      sessionId,
      userId,
      audioBytes: audio.length,
      transcriptLen: transcript.length,
    })

    // Persist user message so analysis can run even if LangGraph checkpointing fails.
    try {
      await prisma.interviewMessage.create({
        data: { sessionId, role: "user", content: transcript },
      })
    } catch (e) {
      logger.warn("Failed to persist user message", { sessionId, error: e })
    }

    const jobContext = session.job
      ? `Job Title: ${session.job.title}\nCompany: ${session.job.company}\nDescription: ${session.job.jobDescription}`
      : ""
    const personaContext = session.persona
      ? `You are ${session.persona.name}, ${session.persona.role} at ${session.persona.company}.\nInterview style: ${session.persona.interviewStyle}\nBackground: ${session.persona.background}`
      : ""

    const graph = await getGraph()
    const stream = await graph.stream(
      {
        messages: [new HumanMessage(transcript)],
        scenarioType: session.scenarioType,
        jobContext,
        personaContext,
      },
      { configurable: { thread_id: sessionId }, streamMode: "messages" }
    )

    let aiResponse = ""
    for await (const [message, metadata] of stream) {
      if (
        metadata.langgraph_node === "question" &&
        message.content &&
        !message.additional_kwargs?.tool_calls
      ) {
        const text = String(message.content)
        const chunks = text.split(/(\s+)/).filter((c) => c.length > 0)
        for (const token of chunks) {
          aiResponse += token
          socket.emit("ai_token", { token })
        }
      }
    }

    const finalText = aiResponse?.trim() || " "

    // Persist assistant message for later feedback generation.
    try {
      await prisma.interviewMessage.create({
        data: { sessionId, role: "assistant", content: finalText },
      })
    } catch (e) {
      logger.warn("Failed to persist assistant message", { sessionId, error: e })
    }

    // Send text immediately (do not block on TTS).
    socket.emit("ai_response", { text: finalText, audio: null })

    // Generate audio in the background and send separately.
    deepgramService
      .AudioToSpeech(finalText)
      .then((audio) => socket.emit("ai_audio", { audio }))
      .catch((e) => logger.warn("TTS failed", { sessionId, error: e }))
  }

  socket.on("user_answer", async (payload: UserAnswerPayload) => {
    const sessionId = payload?.sessionId
    if (!sessionId) {
      socket.emit("error", { message: "Missing sessionId" })
      return
    }

    if (inFlightBySessionId.has(sessionId)) {
      pendingBySessionId.set(sessionId, payload)
      logger.info("user_answer coalesced (in flight)", { sessionId, userId })
      return
    }

    inFlightBySessionId.add(sessionId)
    try {
      await processUserAnswer(payload)
    } catch (error) {
      Sentry.captureException(error)
      logger.error("user_answer error", { error, sessionId, userId })
      socket.emit("error", { message: "Failed to process user answer" })
    } finally {
      inFlightBySessionId.delete(sessionId)
      const pending = pendingBySessionId.get(sessionId)
      if (pending) {
        pendingBySessionId.delete(sessionId)
        // Process one queued payload (latest wins) to keep the conversation linear.
        try {
          inFlightBySessionId.add(sessionId)
          await processUserAnswer(pending)
        } catch (error) {
          Sentry.captureException(error)
          logger.error("user_answer error (pending)", { error, sessionId, userId })
          socket.emit("error", { message: "Failed to process user answer" })
        } finally {
          inFlightBySessionId.delete(sessionId)
        }
      }
    }
  })

  socket.on("end_session", async ({ sessionId }: { sessionId: string }) => {
    try {
      if (!sessionId) {
        socket.emit("error", { message: "Missing sessionId" })
        return
      }

      await prisma.interviewSession.updateMany({
        where: { id: sessionId, userId },
        data: { status: "processing", endedAt: new Date() },
      })

      await analysisQueue.add("analyze_session", { sessionId })

      io.to(sessionId).emit("session_ended", { sessionId })
      socket.leave(sessionId)

      logger.info("Session ended, feedback job enqueued", { sessionId, userId })
    } catch (error) {
      Sentry.captureException(error)
      logger.error("end_session error", { error, sessionId, userId })
      socket.emit("error", { message: "Failed to end session" })
    }
  })

  socket.on("leave_session", (sessionId: string) => {
    socket.leave(sessionId)
    logger.info("User left session", { sessionId, socketId: socket.id, userId })
  })
}
