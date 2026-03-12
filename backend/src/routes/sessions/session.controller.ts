import { Request, Response } from "express"
import * as Sentry from "@sentry/node"
import logger from "../../config/logger"
import { sessionService } from "./session.service"
import { z } from "zod"

const createSessionSchema = z.object({
  scenarioType: z.enum(["technical", "background", "culture"]),
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
