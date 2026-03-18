import { Worker } from "bullmq"
import { prisma } from "../../config/database"
import logger from "../../config/logger"
import * as Sentry from "@sentry/node"
import { buildFeedbackPrompt } from "../../services/ai/prompts/feedback.prompt"
import { redisQueue } from "../../config/redis"

type ScenarioType = "technical" | "background" | "culture"

export const startSessionWorker = async (): Promise<void> => {
  const worker = new Worker(
    "session-analysis",
    async (job) => {
      const { sessionId } = job.data
      
      const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
        select: {
          messages: {
            orderBy: { createdAt: "asc" },
            select: {
              content: true,
              role: true,
            },
          },
          scenarioType: true,
        },
      })

      if (!session) {
        throw new Error(`Session ${sessionId} not found`)
      }

      if (!session.messages || session.messages.length === 0) {
        logger.warn("No messages found for session", { sessionId })
        return null
      }

      const feedback = await createSessionFeedback(
        session.messages, 
        session.scenarioType as ScenarioType
      )

      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { 
          feedback,
          status: "completed"
        },
      })

      logger.info("Session analysis complete", { 
        sessionId, 
        jobId: job.id 
      })

      return feedback
    },
    {
      // Use the same Redis connection config as the Queue (supports Upstash/rediss).
      connection: redisQueue.options,
    }
  )

  worker.on("completed", (job) => {
    logger.info("Job completed", { 
      service: "AscendAI",
      jobId: job.id 
    })
  })

  worker.on("failed", (job, error) => {
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
      
    const feedback = buildFeedbackPrompt(conversationText, scenarioType as ScenarioType)
    
    return feedback
  } catch (error) {
    logger.error("Failed to create session feedback", { 
      service: "AscendAI",
      error 
    })
    throw error
  }
}
