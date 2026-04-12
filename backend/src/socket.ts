import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { registerSessionHandlers } from "./socket/session.handler";
import { socketAuthMiddleware } from "./middleware/socket.auth";
import logger from "./config/logger";
import { env } from "./config/env";

let io: Server;

export const initializeSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    logger.info("Client connected", {
      socketId: socket.id,
      userId: socket.data.userId,
    });

    registerSessionHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      logger.info("Client disconnected", {
        socketId: socket.id,
        userId: socket.data.userId,
        reason,
      });
    });
  });

  return io;
};
