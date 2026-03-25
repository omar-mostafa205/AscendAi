import { prisma } from "../../config/database"
import logger from "../../config/logger"
import { GoogleGenAI, Modality } from "@google/genai"
import { env } from "../../config/env"
import { personaService } from "./persona.service"
import { buildLiveInterviewPrompt } from "../../services/ai/prompts/live.prompt"
import { analysisQueue } from "../../queues/session-analysis-queue"
type ScenarioType = "technical" | "background" | "culture"

async function createSession(
  userId: string,
  jobId: string,
  scenarioType: ScenarioType
) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
  })

  if (!job) throw new Error(`Job not found: ${jobId}`)
  const sessionsCount = await prisma.interviewSession.count({ where: { userId } })
  if (sessionsCount >= 2) {
    throw new Error("Session limit reached. Please contact support to increase your limit.")
  }
  const persona = await personaService.getOrCreatePersona(job, scenarioType)

  const session = await prisma.interviewSession.create({
    data: {
      userId,
      jobId,
      personaId: persona.id,
      scenarioType,
      status: "in_progress",
    },
  })

  return { session }
}

async function listSessions(jobId: string) {
  const sessions = await prisma.interviewSession.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      scenarioType: true,
      status: true,
      createdAt: true,
      overallScore: true,
      feedback: true,
    },
  })

  return sessions.map((session) => ({
    ...session,
    score: session.overallScore,
  }))
}

async function getSessions(jobId: string, userId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: { id: true },
  })

  if (!job) throw new Error(`Job not found: ${jobId}`)

  return listSessions(jobId)
}

async function getSession(sessionId: string, userId: string) {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      jobId: true,
      scenarioType: true,
      status: true,
      startedAt: true,
      endedAt: true,
      overallScore: true,
      feedback: true,
      job: {
        select: {
          title: true,
          company: true,
        },
      },
    },
  })

  if (!session) throw new Error(`Session not found: ${sessionId}`)
  return session
}

async function endSession(sessionId: string, userId: string) {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, status: true },
  })

  if (!session) throw new Error(`Session not found: ${sessionId}`)

  if (session.status === "completed" || session.status === "processing") {
    return { id: sessionId, status: session.status }
  }

  await prisma.interviewSession.updateMany({
    where: { id: sessionId, userId },
    data: {
      status: "processing",
      endedAt: new Date(),
    },
  })

  try {
    await analysisQueue.add("analyze_session", { sessionId })
  } catch (queueError) {
    logger.error("Failed to enqueue analysis job (API end)", { sessionId, userId, error: queueError })
  }

  return { id: sessionId, status: "processing" }
}

async function getLiveToken(
  sessionId: string,
  userId: string,
  scenarioType?: ScenarioType
) {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      scenarioType: true,
      personaId: true,
      jobId: true,
      job: true,
      persona: true,
    },
  })

  if (!session) throw new Error(`Session not found: ${sessionId}`)

  const resolvedScenarioType = (scenarioType ?? (session.scenarioType as ScenarioType)) as
    | "technical"
    | "background"
    | "culture"

  if (!["technical", "background", "culture"].includes(resolvedScenarioType)) {
    throw new Error("Invalid scenarioType")
  }

  const job = session.job
  if (!job) throw new Error("Session job not found")

  const persona =
    session.persona ?? (await personaService.getOrCreatePersona(job, resolvedScenarioType))

  if (!session.personaId && persona?.id) {
    try {
      await prisma.interviewSession.updateMany({
        where: { id: sessionId, userId },
        data: { personaId: persona.id },
      })
    } catch (e) {
      logger.warn("Failed to backfill personaId on session", { sessionId, userId, error: e })
    }
  }

  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  const client = new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
    httpOptions: { apiVersion: "v1alpha" },
  })

  const systemPrompt = buildLiveInterviewPrompt(job, persona, resolvedScenarioType)
  const token = await client.authTokens.create({
    config: {
      uses: 1,
      expireTime,
      liveConnectConstraints: {
        model: env.GEMINI_LIVE_MODEL,
        config: {
          systemInstruction: systemPrompt,
          responseModalities: [Modality.AUDIO],
          sessionResumption: {},


          inputAudioTranscription: {
          },

          outputAudioTranscription: {},

          realtimeInputConfig: {
            automaticActivityDetection: { disabled: true },
          },

          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: resolvedScenarioType === "background" ? "Aoede" : "Charon",
              },
            },
          },
        },
      },
    },
  })

  if (!token?.name) {
    throw new Error("Failed to create live token")
  }

  return { token: token.name, sessionId, model: env.GEMINI_LIVE_MODEL }
}

export const sessionService = {
  createSession,
  getSessions,
  getSession,
  endSession,
  getLiveToken,
} as const
