import { Queue } from "bullmq"
import { redisQueue } from "../config/redis"

export const analysisQueue = new Queue("session-analysis", {
  connection: redisQueue.options,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
})
