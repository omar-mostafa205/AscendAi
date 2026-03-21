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
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("🔧 CORS Configuration:")
  console.log("   FRONTEND_URL:", env.FRONTEND_URL)
  console.log("   Allowed Origins:", allowedOrigins)
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      if (!origin) {
        console.log("✅ No origin - allowing")
        return callback(null, true)
      }

      const normalized = normalizeOrigin(origin)
      const isAllowed = allowedOrigins.includes(normalized)
      
      console.log("🔍 CORS Check:", {
        origin: normalized,
        isAllowed: isAllowed,
        allowedOrigins: allowedOrigins
      })

      if (isAllowed) {
        console.log("✅ Origin allowed:", normalized)
        callback(null, true) // ← MAKE SURE THIS IS HERE
      } else {
        console.log("❌ Origin blocked:", normalized)
        callback(null, false) // ← MAKE SURE THIS IS HERE (not new Error)
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Accept"],
  }

  app.use(cors(corsOptions))
  app.options(/.*/, cors(corsOptions))
  
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  )
  
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(requestLogger)

  app.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      cors: {
        allowedOrigins: allowedOrigins,
        requestOrigin: req.headers.origin,
      }
    })
  })

  // ✅ ADD THIS DEBUG ENDPOINT HERE (before routes)
  app.get("/api/v1/debug/cors", (req, res) => {
    const testOrigin = "https://ascendxai.vercel.app"
    const normalized = normalizeOrigin(testOrigin)
    
    res.json({
      environment: {
        FRONTEND_URL: env.FRONTEND_URL,
        NODE_ENV: env.NODE_ENV,
      },
      parsed: {
        allowedOrigins: getAllowedOrigins(),
      },
      request: {
        origin: req.headers.origin,
        host: req.headers.host,
        method: req.method,
      },
      test: {
        testOrigin: testOrigin,
        normalized: normalized,
        wouldAllow: getAllowedOrigins().includes(normalized),
      },
      currentCorsCallback: "Check if using callback(null, true/false) instead of throwing error"
    })
  })

  app.use("/api/v1", routes)

  Sentry.setupExpressErrorHandler(app) 
  app.use(notFoundHandler)
  app.use(errorHandler)

  const io = initializeSocket(server)

  return { app, server, io }
}