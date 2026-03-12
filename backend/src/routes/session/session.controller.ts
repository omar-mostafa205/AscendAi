import { Request, Response } from "express"
import { z } from "zod"
import * as Sentry from "@sentry/node"
import logger from "../../config/logger"
import { prisma } from "../../config/database"
import { LivekitService } from "../../services/voice/livekit.service"
import { analysisQueue } from "../../queues/session-analysis-queue"

export const getSessionById = async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.params.sessionId as string
  if (!z.string().uuid().safeParse(sessionId).success) {
    res.status(404).json({ error: "Session not found" })
    return
  }

  try {
    const session = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId: req.user!.id },
      include: { job: true },
    })

    if (!session) {
      res.status(404).json({ error: "Session not found" })
      return
    }

    let livekitToken: string | null = null
    try {
      livekitToken = await LivekitService.generateToken(session.id, req.user!.id)
    } catch (e) {
      logger.warn("Failed to generate LiveKit token", { sessionId, error: e })
    }

    res.status(200).json({
      data: {
        id: session.id,
        userId: session.userId,
        jobId: session.jobId,
        personaId: session.personaId,
        scenarioType: session.scenarioType,
        status: session.status,
        overallScore: session.overallScore,
        feedback: session.feedback,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        createdAt: session.createdAt,
        job: session.job ? { title: session.job.title, company: session.job.company } : undefined,
        livekitToken,
      },
    })
  } catch (error) {
    Sentry.captureException(error, { extra: { sessionId, userId: req.user!.id } })
    logger.error("Failed to fetch session", { error, sessionId, userId: req.user!.id })
    res.status(500).json({ error: "Internal Server Error" })
  }
}

export const endSessionById = async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.params.sessionId as string
  if (!z.string().uuid().safeParse(sessionId).success) {
    res.status(404).json({ error: "Session not found" })
    return
  }

  try {
    const existing = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId: req.user!.id },
      select: { id: true, status: true },
    })

    if (!existing) {
      res.status(404).json({ error: "Session not found" })
      return
    }

    // Idempotent end: if already completed/processing, just return 200.
    if (existing.status === "completed" || existing.status === "processing") {
      res.status(200).json({ data: { id: sessionId, status: existing.status } })
      return
    }

    await prisma.interviewSession.updateMany({
      where: { id: sessionId, userId: req.user!.id },
      data: { status: "processing", endedAt: new Date() },
    })

    await analysisQueue.add("analyze_session", { sessionId })

    res.status(200).json({ data: { id: sessionId, status: "processing" } })
  } catch (error) {
    Sentry.captureException(error, { extra: { sessionId, userId: req.user!.id } })
    logger.error("Failed to end session", { error, sessionId, userId: req.user!.id })
    res.status(500).json({ error: "Internal Server Error" })
  }
}
