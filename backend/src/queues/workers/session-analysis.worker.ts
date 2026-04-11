import { Worker } from "bullmq"
import { prisma } from "../../config/database"
import logger from "../../config/logger"
import * as Sentry from "@sentry/node"
import { buildFeedbackPrompt } from "../../services/ai/prompts/feedback.prompt"
import { redisQueue } from "../../config/redis"
import { GoogleGenAI } from "@google/genai"
import { env } from "../../config/env"


type ScenarioType = "technical" | "background" | "culture"

let sessionWorker: Worker | null = null

export  const getSessionWorker = ()=> sessionWorker
export const startSessionWorker = async (): Promise<void> => {
   sessionWorker = new Worker(
    "session-analysis",
    async (job) => {
      const { sessionId } = job.data
      
      const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
        select: {
          messages: true,
          scenarioType: true,
        },
      })

      if (!session) {
        throw new Error(`Session ${sessionId} not found`)
      }

      const messages = Array.isArray(session.messages) ? (session.messages as any[]) : []
      if (messages.length === 0) {
        logger.warn("No messages found for session", { sessionId })
        await prisma.interviewSession.update({
          where: { id: sessionId },
          data: {
            status: "completed",
            overallScore: 0,
            feedback: {
              overallScore: 0,
              strengths: [],
              weaknesses: [],
              recommendations: [],
              summary: "No interview messages were recorded for this session.",
            } as any,
          },
        })
        return null
      }

      const feedbackData = await createSessionFeedback(
        messages.map((m) => ({ content: String(m?.content ?? ""), role: String(m?.role ?? "") })), 
        session.scenarioType as ScenarioType
      )

      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { 
          feedback: feedbackData,
          overallScore: feedbackData.overallScore || 0,
          status: "completed"
        },
      })

      logger.info("Session analysis complete", { 
        sessionId, 
        jobId: job.id 
      })

      return feedbackData
    },
    {
      connection: redisQueue.options,
      drainDelay: 60,
      stalledInterval: 60000,
      lockDuration: 60000, 

    }
  )

  sessionWorker.on("completed", (job) => {
    logger.info("Job completed", { 
      service: "AscendAI",
      jobId: job.id 
    })
  })

  sessionWorker.on("failed", (job, error) => {
    Sentry.captureException(error, {
      extra: { 
        jobId: job?.id, 
        sessionId: job?.data?.sessionId 
      },
    })
    logger.error("Job failed", { 
      service: "AscendAI",
      jobId: job?.id, 
      error 
    })
  })
}

const createSessionFeedback = async (
  conversation: { content: string; role: string }[],
  scenarioType: string
) => {
  try {
    const conversationText = conversation
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n")
      
    const prompt = buildFeedbackPrompt(conversationText, scenarioType as ScenarioType)
    
    const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
    
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    })

    const text = response.text
    if (!text) {
      throw new Error("No text returned from Gemini")
    }

    const parsed = JSON.parse(text)
    return parsed
  } catch (error) {
    logger.error("Failed to create session feedback", { 
      service: "AscendAI",
      error 
    })
    throw error
  }
}
