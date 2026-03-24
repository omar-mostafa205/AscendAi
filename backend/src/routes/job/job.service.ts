import { prisma } from "../../config/database"
import logger from "../../config/logger"

interface CreateJobInput {
  userId: string
  title: string
  company: string
  jobDescription: string
}



const createJob = async ({ userId, title, company, jobDescription }: CreateJobInput) => {
  const job = await prisma.job.create({
    data: {
      userId,
      title,
      company,
      jobDescription
    },
  })
  logger.info("Job created", { userId, jobId: job.id })
  return job
}


const getJobs = async (userId: string) => {
  const jobs = await prisma.job.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      title: true,
      company: true,
      jobDescription: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  })

  logger.info("Jobs fetched", { userId, count: jobs.length })
  return jobs
}

const getJobById = async (jobId: string, userId: string) => {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      userId: true,
      title: true,
      company: true,
      jobDescription: true,
      createdAt: true,
    },
  })
  logger.info("Jobs fetched", { userId })
  if (!job) {
    logger.warn("Job not found", { jobId, userId })
    throw new Error("Job not found")
  }

  return job
}

export default {
  getJobs,
  getJobById,
  createJob,
}
