import Redis from "ioredis"
import { env } from "./env"
import logger from "./logger"

export const redisQueue = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => {
    if (times > 10) {
      logger.error("Redis connection failed after 10 retries")
      return null
    }
    return Math.min(times * 50, 2000)
  },
})

redisQueue.on("ready", () => logger.info("Redis ready"))
redisQueue.on("error", (err) => logger.error("Redis error", { error: err.message }))
