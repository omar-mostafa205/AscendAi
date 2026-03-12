import express from "express"
import cors from "cors"
import helmet from "helmet"
import http from "http"
import * as Sentry from "@sentry/node"
import { requestLogger } from "./middleware/logger"
import { errorHandler, notFoundHandler } from "./middleware/error"
import { initializeSocket } from "./socket"
import routes from "./routes"
import { env } from "./config/env"

export const createServer = () => {
  const app = express()
  const server = http.createServer(app)

  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PATCH"],
  }))
  app.use(helmet())
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
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