"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSessionHandlers = void 0;
const database_1 = require("../config/database");
const logger_1 = __importDefault(require("../config/logger"));
const session_analysis_queue_1 = require("../queues/session-analysis-queue");
const Sentry = __importStar(require("@sentry/node"));
const activeSocketIdBySessionUserKey = new Map();
const disconnectTimersBySessionId = new Map();
function clearDisconnectTimer(sessionId) {
    const timer = disconnectTimersBySessionId.get(sessionId);
    if (timer) {
        clearTimeout(timer);
        disconnectTimersBySessionId.delete(sessionId);
    }
}
const registerSessionHandlers = (io, socket) => {
    const userId = socket.data.userId;
    const joinedSessionIds = new Set();
    socket.on("join_session", async (payload) => {
        const sessionId = typeof payload === "string" ? payload : payload?.sessionId;
        if (!sessionId) {
            socket.emit("error", { message: "Missing sessionId" });
            return;
        }
        try {
            clearDisconnectTimer(sessionId);
            const session = await database_1.prisma.interviewSession.findFirst({
                where: { id: sessionId, userId },
                select: { id: true, status: true },
            });
            if (!session) {
                socket.emit("error", { message: "Session not found or access denied" });
                return;
            }
            if (session.status === "completed" || session.status === "processing") {
                socket.emit("error", { message: "Session already ended" });
                return;
            }
            if (joinedSessionIds.has(sessionId)) {
                socket.join(sessionId);
                socket.emit("session_joined", { sessionId });
                return;
            }
            const sessionUserKey = `${sessionId}:${userId}`;
            const existingSocketId = activeSocketIdBySessionUserKey.get(sessionUserKey);
            if (existingSocketId && existingSocketId !== socket.id) {
                const oldSocket = io.sockets.sockets.get(existingSocketId);
                if (oldSocket) {
                    oldSocket.leave(sessionId);
                    oldSocket.disconnect(true);
                }
            }
            activeSocketIdBySessionUserKey.set(sessionUserKey, socket.id);
            socket.join(sessionId);
            joinedSessionIds.add(sessionId);
            logger_1.default.info("User joined session", {
                service: "AscendAI",
                sessionId,
                userId
            });
            socket.emit("session_joined", { sessionId });
        }
        catch (error) {
            Sentry.captureException(error);
            logger_1.default.error("join_session error", { error, sessionId, userId });
            socket.emit("error", { message: "Failed to join session" });
        }
    });
    socket.on("save_message", async (payload) => {
        const { sessionId, role, content } = payload || {};
        if (!sessionId || !role || !content?.trim()) {
            return;
        }
        const trimmedContent = content.trim();
        if (trimmedContent.length > 8000) {
            logger_1.default.warn("Message too long", { sessionId, userId, length: trimmedContent.length });
            return;
        }
        try {
            const session = await database_1.prisma.interviewSession.findFirst({
                where: { id: sessionId, userId },
                select: { id: true, status: true },
            });
            if (!session) {
                logger_1.default.warn("save_message: session not found", { sessionId, userId });
                return;
            }
            if (session.status !== "active" && session.status !== "in_progress") {
                logger_1.default.warn("save_message: session not active", { sessionId, userId, status: session.status });
                return;
            }
            const existingMessage = await database_1.prisma.interviewMessage.findFirst({
                where: {
                    sessionId,
                    role,
                    content: trimmedContent,
                    createdAt: {
                        gte: new Date(Date.now() - 5000)
                    }
                },
            });
            if (existingMessage) {
                logger_1.default.debug("Duplicate message ignored", { sessionId, role });
                return;
            }
            await database_1.prisma.interviewMessage.create({
                data: {
                    sessionId,
                    role,
                    content: trimmedContent
                },
            });
            logger_1.default.debug("Message saved", { sessionId, role, length: trimmedContent.length });
        }
        catch (error) {
            Sentry.captureException(error);
            logger_1.default.error("save_message error", { sessionId, userId, role, error });
        }
    });
    socket.on("end_session", async ({ sessionId }) => {
        if (!sessionId) {
            socket.emit("error", { message: "Missing sessionId" });
            return;
        }
        try {
            const session = await database_1.prisma.interviewSession.findFirst({
                where: { id: sessionId, userId },
                select: { id: true, status: true },
            });
            if (!session) {
                socket.emit("error", { message: "Session not found or access denied" });
                return;
            }
            if (session.status === "completed" || session.status === "processing") {
                socket.emit("error", { message: "Session already ended" });
                return;
            }
            await database_1.prisma.interviewSession.updateMany({
                where: { id: sessionId, userId },
                data: {
                    status: "processing",
                    endedAt: new Date()
                },
            });
            try {
                await session_analysis_queue_1.analysisQueue.add("analyze_session", { sessionId });
            }
            catch (queueError) {
                Sentry.captureException(queueError);
                logger_1.default.error("Failed to enqueue analysis job", { sessionId, userId, error: queueError });
            }
            io.to(sessionId).emit("session_ended", { sessionId });
            socket.leave(sessionId);
            joinedSessionIds.delete(sessionId);
            const sessionUserKey = `${sessionId}:${userId}`;
            if (activeSocketIdBySessionUserKey.get(sessionUserKey) === socket.id) {
                activeSocketIdBySessionUserKey.delete(sessionUserKey);
            }
            logger_1.default.info("Session ended, feedback job enqueued", {
                service: "AscendAI",
                sessionId,
                userId
            });
        }
        catch (error) {
            Sentry.captureException(error);
            logger_1.default.error("end_session error", { error, sessionId, userId });
            socket.emit("error", { message: "Failed to end session" });
        }
    });
    socket.on("leave_session", (sessionId) => {
        if (!sessionId)
            return;
        socket.leave(sessionId);
        joinedSessionIds.delete(sessionId);
        const sessionUserKey = `${sessionId}:${userId}`;
        if (activeSocketIdBySessionUserKey.get(sessionUserKey) === socket.id) {
            activeSocketIdBySessionUserKey.delete(sessionUserKey);
        }
        logger_1.default.info("User left session", {
            service: "AscendAI",
            sessionId,
            socketId: socket.id,
            userId
        });
    });
    socket.on("disconnect", async (reason) => {
        if (joinedSessionIds.size === 0)
            return;
        for (const sessionId of joinedSessionIds) {
            const sessionUserKey = `${sessionId}:${userId}`;
            if (activeSocketIdBySessionUserKey.get(sessionUserKey) === socket.id) {
                activeSocketIdBySessionUserKey.delete(sessionUserKey);
            }
            clearDisconnectTimer(sessionId);
            const timer = setTimeout(async () => {
                try {
                    const roomSize = io.sockets.adapter.rooms.get(sessionId)?.size ?? 0;
                    if (roomSize > 0) {
                        logger_1.default.debug("Session still has active connections", { sessionId, roomSize });
                        return;
                    }
                    const session = await database_1.prisma.interviewSession.findFirst({
                        where: { id: sessionId, userId },
                        select: { id: true, status: true },
                    });
                    if (!session)
                        return;
                    if (session.status !== "in_progress" && session.status !== "active") {
                        logger_1.default.debug("Session not active, skipping auto-end", { sessionId, status: session.status });
                        return;
                    }
                    const userMsgCount = await database_1.prisma.interviewMessage.count({
                        where: { sessionId, role: "user" },
                    });
                    if (userMsgCount === 0) {
                        logger_1.default.debug("No user messages, skipping auto-end", { sessionId });
                        return;
                    }
                    await database_1.prisma.interviewSession.updateMany({
                        where: { id: sessionId, userId },
                        data: {
                            status: "processing",
                            endedAt: new Date()
                        },
                    });
                    try {
                        await session_analysis_queue_1.analysisQueue.add("analyze_session", { sessionId });
                    }
                    catch (queueError) {
                        logger_1.default.error("Failed to enqueue analysis on disconnect", {
                            sessionId,
                            userId,
                            error: queueError
                        });
                    }
                    io.to(sessionId).emit("session_ended", { sessionId });
                    logger_1.default.info("Session ended on disconnect", {
                        service: "AscendAI",
                        sessionId,
                        userId,
                        reason
                    });
                }
                catch (error) {
                    Sentry.captureException(error);
                    logger_1.default.error("Failed to end session on disconnect", {
                        sessionId,
                        userId,
                        reason,
                        error
                    });
                }
                finally {
                    disconnectTimersBySessionId.delete(sessionId);
                }
            }, 5000);
            disconnectTimersBySessionId.set(sessionId, timer);
        }
        joinedSessionIds.clear();
    });
};
exports.registerSessionHandlers = registerSessionHandlers;
//# sourceMappingURL=session.handler.js.map