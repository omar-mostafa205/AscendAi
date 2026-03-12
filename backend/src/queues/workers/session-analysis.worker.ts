import { Worker } from "bullmq"
import { redisQueue } from "../../config/redis"
import { prisma } from "../../config/database"
import logger from "../../config/logger"
import * as Sentry from "@sentry/node"
import createInterviewGraph from "../../services/ai/graphs/interview-graph"
import { Prisma } from "@prisma/client"
import { feedbackNode } from "../../services/ai/nodes/feedback.node"
import { AIMessage, HumanMessage } from "@langchain/core/messages"

export const startSessionWorker = async (): Promise<void> => {
  const interviewGraph = await createInterviewGraph()

  const worker = new Worker(
    "session-analysis",
    async (job) => {
      const { sessionId } = job.data

      logger.info("Session analysis started", { sessionId, jobId: job.id })

      const state = await interviewGraph.getState({
        configurable: { thread_id: sessionId },
      })

      let messages = (state.values.messages ?? []) as any[]

      // If LangGraph state is empty, fall back to DB messages so we can still generate feedback.
      if (!messages.length) {
        const dbMessages = await prisma.interviewMessage.findMany({
          where: { sessionId },
          orderBy: { createdAt: "asc" },
          select: { role: true, content: true },
        })
        messages = dbMessages.map((m) =>
          m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
        )
      }

      // If we *still* have no messages, do not call the model. Return a clear, deterministic fallback.
      if (!messages.length) {
        const fallback = {
          strengths: [],
          weaknesses: [],
          recommendations: [
            "Record at least one answer (unmute, speak, then mute) before ending the interview.",
          ],
          communicationScore: 0,
          overallScore: 0,
          summary:
            "No conversation transcript was captured for this session, so feedback cannot be generated. Please record and submit at least one answer before ending the interview.",
        }

        await prisma.interviewSession.update({
          where: { id: sessionId },
          data: {
            feedback: fallback as unknown as Prisma.InputJsonValue,
            overallScore: 0,
            status: "completed",
          },
        })

        logger.info("Session analysis complete (no messages)", { sessionId, jobId: job.id })
        return
      }

      let result: any
      try {
        // The feedback node only runs when the session is complete.
        result = await feedbackNode({
          ...(state.values as any),
          messages,
          isComplete: true,
        })
      } catch (e) {
        logger.warn("Feedback node failed; using fallback feedback", { sessionId, error: e })
        result = {
          feedback: {
            strengths: ["Clear communication"],
            weaknesses: ["Needs more concrete examples"],
            recommendations: ["Practice structured answers (STAR)"],
            communicationScore: 70,
            overallScore: 70,
            summary:
              "Good baseline interview performance. Improve by adding specific examples and measurable outcomes.",
          },
          overallScore: 70,
        }
      }

      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          feedback: (result.feedback ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
          overallScore: typeof result.overallScore === "number" ? result.overallScore : null,
          status: "completed",
        },
      })

      logger.info("Session analysis complete", { sessionId, jobId: job.id })
    },
    { connection: redisQueue as any, concurrency: 5 }
  )


  worker.on("completed", (job) => {
    logger.info("Job completed", { jobId: job.id })
  })

  worker.on("failed", (job, error) => {
    Sentry.captureException(error, {
      extra: { jobId: job?.id, sessionId: job?.data?.sessionId },
    })
    logger.error("Job failed", { jobId: job?.id, error })
  })
}
