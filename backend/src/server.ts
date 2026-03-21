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

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, "")
}

function getAllowedOrigins(): string[] {
  const raw = env.FRONTEND_URL
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeOrigin)
}

export const createServer = () => {
  const app = express()
  const server = http.createServer(app)

  const allowedOrigins = getAllowedOrigins()
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true) // non-browser or same-origin
      const normalized = normalizeOrigin(origin)
      const ok = allowedOrigins.includes(normalized)
      callback(ok ? null : new Error("Not allowed by CORS"), ok)
    },
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  }

  app.use(cors(corsOptions))
  app.options("*", cors(corsOptions))
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
