import { Server } from "socket.io"
import { Server as HttpServer } from "http"
import { registerSessionHandlers } from "./socket/session.handler"
import { socketAuthMiddleware } from "./middleware/socket.auth"
import logger from "./config/logger"
import { env } from "./config/env"

let io: Server

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

export const initializeSocket = (httpServer: HttpServer): Server => {
  const allowedOrigins = getAllowedOrigins()

  console.log("🔧 Socket.IO CORS Config:", allowedOrigins)

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          console.log("✅ WebSocket: No origin - allowing")
          return callback(null, true)
        }

        const normalized = normalizeOrigin(origin)
        const isAllowed = allowedOrigins.includes(normalized)

        console.log("🔍 WebSocket CORS Check:", {
          origin: normalized,
          isAllowed: isAllowed
        })

        if (isAllowed) {
          console.log("✅ WebSocket origin allowed:", normalized)
          callback(null, true) // ✅ FIXED
        } else {
          console.log("❌ WebSocket origin blocked:", normalized)
          callback(null, false) // ✅ FIXED - don't throw error
        }
      },
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  })

  io.use(socketAuthMiddleware)

  io.on("connection", (socket) => {
    logger.info("Client connected", {
      socketId: socket.id,
      userId: socket.data.userId,
    })

  registerSessionHandlers(io, socket)

    socket.on("disconnect", (reason) => {
      logger.info("Client disconnected", {
        socketId: socket.id,
        userId: socket.data.userId,
        reason,
      })
    })
  })

  return io
}
