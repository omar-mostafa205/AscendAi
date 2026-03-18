import { Request, Response } from "express"
import * as Sentry from "@sentry/node"
import logger from "../../config/logger"
import { sessionService } from "./session.service"
import { z } from "zod"

const createSessionSchema = z.object({
  scenarioType: z.enum(["technical", "background", "culture"]),
})

const sessionIdSchema = z.string().uuid()

const liveTokenBodySchema = z.object({
  scenarioType: z.enum(["technical", "background", "culture"]).optional(),
})

export const getSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = req.params.jobId as string
    if (!z.string().uuid().safeParse(jobId).success) {
      res.status(404).json({ error: "Job not found" })
      return
    }

    const sessions = await sessionService.getSessions(jobId, req.user.id)
    res.status(200).json({ data: sessions })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Job not found")) {
      res.status(404).json({ error: "Job not found" })
      return
    }
    Sentry.captureException(error, { extra: { jobId: req.params.jobId } })
    logger.error("Failed to fetch sessions", { error, jobId: req.params.jobId })
    res.status(500).json({ error: "Internal Server Error" })
  }
}

export const createSession = async (req: Request, res: Response): Promise<void> => {
  const jobId = req.params.jobId as string
  if (!z.string().uuid().safeParse(jobId).success) {
    res.status(404).json({ error: "Job not found" })
    return
  }

  const validated = createSessionSchema.safeParse(req.body)

  if (!validated.success) {
    res.status(400).json({ error: validated.error.flatten().fieldErrors })
    return
  }

  try {
    const session = await sessionService.createSession(
      req.user.id,
      jobId,
      validated.data.scenarioType
    )
    res.status(201).json({ data: session })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Job not found")) {
      res.status(404).json({ error: "Job not found" })
      return
    }
    Sentry.captureException(error, { extra: { userId: req.user.id, jobId: req.params.jobId } })
    logger.error("Failed to create session", { error, userId: req.user.id, jobId: req.params.jobId })
    res.status(500).json({ error: "Internal Server Error" })
  }
}

export const getSession = async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.params.id as string
  if (!sessionIdSchema.safeParse(sessionId).success) {
    res.status(404).json({ error: "Session not found" })
    return
  }

  try {
    const session = await sessionService.getSession(sessionId, req.user.id)
    res.status(200).json({ data: session })
  } catch (error) {
    logger.error("Failed to get session", { error, userId: req.user.id, sessionId })
    if (error instanceof Error && error.message.startsWith("Session not found")) {
      res.status(404).json({ error: "Session not found" })
      return
    }
    Sentry.captureException(error, { extra: { userId: req.user.id, sessionId } })
    res.status(500).json({ error: "Internal Server Error" })
  }
}

export const endSession = async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.params.id as string
  if (!sessionIdSchema.safeParse(sessionId).success) {
    res.status(404).json({ error: "Session not found" })
    return
  }

  try {
    const result = await sessionService.endSession(sessionId, req.user.id)
    res.status(200).json({ data: result })
  } catch (error) {
    logger.error("Failed to end session", { error, userId: req.user.id, sessionId })
    if (error instanceof Error && error.message.startsWith("Session not found")) {
      res.status(404).json({ error: "Session not found" })
      return
    }
    Sentry.captureException(error, { extra: { userId: req.user.id, sessionId } })
    res.status(500).json({ error: "Internal Server Error" })
  }
}

export const getLiveToken = async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.params.id as string
  if (!sessionIdSchema.safeParse(sessionId).success) {
    res.status(404).json({ error: "Session not found" })
    return
  }

  const validated = liveTokenBodySchema.safeParse(req.body)
  if (!validated.success) {
    res.status(400).json({ error: validated.error.flatten().fieldErrors })
    return
  }

  try {
    const tokenData = await sessionService.getLiveToken(
      sessionId,
      req.user.id,
      validated.data.scenarioType
    )
    res.status(200).json({ data: tokenData })
  } catch (error) {
    logger.error("Failed to get live token", { error, userId: req.user.id, sessionId })
    if (
      error instanceof Error &&
      (error.message.startsWith("Session not found") || error.message === "Session job not found")
    ) {
      res.status(404).json({ error: "Session not found" })
      return
    }
    Sentry.captureException(error, { extra: { userId: req.user.id, sessionId } })
    res.status(500).json({ error: "Internal Server Error" })
  }
}
