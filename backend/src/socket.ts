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

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true)
        const ok = allowedOrigins.includes(normalizeOrigin(origin))
        callback(ok ? null : new Error("Not allowed by CORS"), ok)
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
