import express from "express"
import cors from "cors"
import helmet from "helmet"
import http from "http"
import * as Sentry from "@sentry/node"
import { requestLogger } from "./middleware/logger"
import { errorHandler, notFoundHandler } from "./middleware/error"
import { initializeSocket } from "./socket"
import routes from "./modules"
import { env } from "./config/env"
import { rateLimitMiddleware } from "./middleware/rate-limit.middleware"

export const createServer = () => {
  const app = express()
  const server = http.createServer(app)

  app.set("trust proxy", 1)

  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PATCH"],
  }))

  app.use(helmet({
    contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
  }))

  app.use(express.json({ limit: "10kb" }))
  app.use(express.urlencoded({ extended: true, limit: "10kb" }))

  app.use(rateLimitMiddleware)
  app.use(requestLogger)

  app.get("/health", (_, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    })
  })

  app.use("/api/v1", routes)

  Sentry.setupExpressErrorHandler(app)
  app.use(notFoundHandler)
  app.use(errorHandler)

  const io = initializeSocket(server)

  return { app, server, io }
}