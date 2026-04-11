import { Request, Response } from "express"
import * as Sentry from "@sentry/node"
import logger from "../../config/logger"
import jobService from "./job.service"
import { z } from "zod"


const createJobSchema = z.object({
  title: z.string().min(2).max(100),
  company: z.string().min(2).max(100),
  jobDescription: z.string().min(50).max(5000),
})


export const getJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobs = await jobService.getJobs(req.user!.id)
    res.status(200).json({ data: jobs })
  } catch (error) {
    Sentry.captureException(error, { extra: { userId: req.user!.id } })
    logger.error("Failed to fetch jobs", { error, userId: req.user!.id })
    res.status(500).json({ error: "Internal Server Error" })
  }
}

export const getJobById = async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await jobService.getJobById(req.params.id as string, req.user!.id)
    res.status(200).json({ data: job })
  } catch (error) {
    if (error instanceof Error && error.message === "Job not found") {
      res.status(404).json({ error: "Job not found" })
      return
    }
    Sentry.captureException(error, { extra: { userId: req.user!.id, jobId: req.params.id } })
    logger.error("Failed to fetch job", { error, userId: req.user!.id, jobId: req.params.id })
    res.status(500).json({ error: "Internal Server Error" })
  }
}

export const createJob = async (req: Request, res: Response): Promise<void> => {
  const validated = createJobSchema.safeParse(req.body)

  if (!validated.success) {
    res.status(400).json({ error: validated.error.flatten().fieldErrors })
    return
  }

  try {
    const job = await jobService.createJob({
      userId: req.user!.id,
      ...validated.data,
    })
    res.status(201).json({ data: job })
  } catch (error) {
    Sentry.captureException(error, { extra: { userId: req.user!.id } })
    logger.error("Failed to create job", { error, userId: req.user!.id })
    res.status(500).json({ error: "Internal Server Error" })
  }
}
