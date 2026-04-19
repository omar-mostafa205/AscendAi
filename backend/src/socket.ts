import { Server } from "socket.io"
import { Server as HttpServer } from "http"
import { registerSessionHandlers } from "./socket/session.handler"
import { socketAuthMiddleware } from "./middleware/socket.auth"
import logger from "./config/logger"
import { env } from "./config/env"

let io: Server

export const initializeSocket = (httpServer: HttpServer): Server => {
  logger.info("Initializing Socket.IO", {
    frontendUrl: env.FRONTEND_URL,
    transports: ["websocket", "polling"],
  });

  io = new Server(httpServer, {
    cors: {
      origin: [
        env.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  })

  io.use(socketAuthMiddleware);

  // Log middleware errors (auth failures show up here)
  io.use((socket, next) => {
    logger.info("Socket middleware passed", {
      socketId: socket.id,
      userId: socket.data?.userId,
      handshake: {
        origin: socket.handshake.headers.origin,
        transport: socket.conn.transport.name,
      },
    });
    next();
  });

  io.on("connection", (socket) => {
    logger.info("Client connected", {
      socketId: socket.id,
      userId: socket.data.userId,
    });

    // Log ALL events from this socket for debugging
    socket.onAny((event, ...args) => {
      logger.info("Socket event received", {
        socketId: socket.id,
        userId: socket.data.userId,
        event,
        args,
      });
    });

    registerSessionHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      logger.info("Client disconnected", {
        socketId: socket.id,
        userId: socket.data.userId,
        reason,
      });
    });

    socket.on("connect_error", (err) => {
      logger.error("Socket connect_error", {
        socketId: socket.id,
        message: err.message,
      });
    });
  });

  // Catch engine-level errors (before Socket.IO layer)
  io.engine.on("connection_error", (err) => {
    logger.error("Engine connection_error", {
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  return io;
};