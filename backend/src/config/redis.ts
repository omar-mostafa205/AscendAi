import Redis from "ioredis";
import { env } from "./env";
import logger from "./logger";

export const redisQueue = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  connectTimeout: 15000,
  keepAlive: 30000,
  retryStrategy: (times: number) => {
    if (times > 10) {
      logger.error("Redis connection failed after 10 retries");
      return null;
    }
    return Math.min(200 + times * 250, 5000);
  },
});

logger.info("Redis configured", {
  host: redisQueue.options.host,
  port: redisQueue.options.port,
  tls: !!redisQueue.options.tls,
});

redisQueue.on("ready", () => logger.info("Redis ready"));
redisQueue.on("reconnecting", (time: number) =>
  logger.warn("Redis reconnecting", { time }),
);
redisQueue.on("end", () => logger.warn("Redis connection ended"));
redisQueue.on("error", (err) =>
  logger.error("Redis error", { error: err?.message ?? String(err) }),
);
