import { createServer } from "./server"
import { connectDb, disconnectDb } from "./config/database"
import { redisQueue } from "./config/redis"
import logger from "./config/logger"
import { initSentry } from "./config/sentry"
import * as Sentry from "@sentry/node"
import { startSessionWorker } from "./queues/workers/session-analysis.worker"
import { env } from "./config/env"


for (const s of [process.stdout, process.stderr]) {
  s.on("error", (err: any) => {
    if (err?.code === "EPIPE") process.exit(0)
  })
}

async function bootstrap() {
  try {
    initSentry()

    await connectDb()

    await redisQueue.ping()
    logger.info("Redis connected")

    const { app, server, io } = createServer()

    await startSessionWorker()

    const PORT = env.PORT

    server.listen(PORT, () => {
      logger.info("Server started", {
        port: PORT,
        environment: env.NODE_ENV,
      })
    })

    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`)

      server.close(() => logger.info("HTTP server closed"))
      io.close(() => logger.info("WebSocket server closed"))

      await redisQueue.quit()
      await Sentry.close(2000)
      await disconnectDb()

      process.exit(0)
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"))
    process.on("SIGINT", () => shutdown("SIGINT"))

  } catch (error) {
    logger.error("Failed to start server", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    })
    Sentry.captureException(error, { tags: { phase: "startup" } })
    await Sentry.close(2000)
    process.exit(1)
  }
}

bootstrap()
