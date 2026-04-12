import { supabaseAdmin } from "../config/supabase";
import { logger } from "@sentry/node";
import { Socket } from "socket.io";
export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void,
) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    logger.warn("Socket auth middleware: missing token", {
      path: socket.handshake.url,
      address: socket.handshake.address,
    });
    next(new Error("Authentication error"));
    return;
  }
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      logger.warn("Socket auth middleware: invalid token", {
        path: socket.handshake.url,
        address: socket.handshake.address,
        error: error?.message,
      });
      next(new Error("Authentication error"));
      return;
    }
    socket.data.userId = data.user.id;
    socket.data.email = data.user.email;

    next();
  } catch (error) {
    logger.error("Socket auth error", { error, socketId: socket.id });
    next(new Error("Internal Server Error"));
  }
};
