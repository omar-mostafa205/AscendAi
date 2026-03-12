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
const interview_graph_1 = __importDefault(require("../services/ai/graphs/interview-graph"));
const deepgram_service_1 = require("../services/voice/deepgram.service");
const Sentry = __importStar(require("@sentry/node"));
const messages_1 = require("@langchain/core/messages");
// Prevent overlapping processing for the same session (which can cause repeated questions).
const inFlightBySessionId = new Set();
const pendingBySessionId = new Map();
let graphInstance = null;
async function getGraph() {
    if (!graphInstance)
        graphInstance = await (0, interview_graph_1.default)();
    return graphInstance;
}
function sanitizeAudioContentType(mimeType) {
    if (typeof mimeType !== "string")
        return "audio/webm";
    const v = mimeType.trim().toLowerCase();
    if (!v || !v.startsWith("audio/"))
        return "audio/webm";
    // Keep codecs if present; Deepgram can use it, and stripping it can hurt for some browsers.
    return v;
}
function normalizeToBuffer(raw) {
    if (!raw)
        return Buffer.alloc(0);
    if (Buffer.isBuffer(raw))
        return raw;
    if (raw instanceof ArrayBuffer)
        return Buffer.from(new Uint8Array(raw));
    // socket.io can sometimes send { type: "Buffer", data: number[] }
    if (raw?.type === "Buffer" && Array.isArray(raw.data))
        return Buffer.from(raw.data);
    if (raw?.data && Array.isArray(raw.data))
        return Buffer.from(raw.data);
    if (Array.isArray(raw))
        return Buffer.from(raw);
    if (ArrayBuffer.isView(raw))
        return Buffer.from(raw);
    return Buffer.from(raw);
}
const registerSessionHandlers = (io, socket) => {
    const userId = socket.data.userId;
    socket.on("join_session", async (payload) => {
        const sessionId = typeof payload === "string" ? payload : payload?.sessionId;
        if (!sessionId) {
            socket.emit("error", { message: "Missing sessionId" });
            return;
        }
        try {
            const session = await database_1.prisma.interviewSession.findFirst({
                where: { id: sessionId, userId },
                include: { persona: true, job: true },
            });
            if (!session) {
                socket.emit("error", { message: "Session not found or access denied" });
                return;
            }
            socket.join(sessionId);
            logger_1.default.info("User joined session", { sessionId, userId });
            socket.emit("session_joined", { sessionId });
        }
        catch (error) {
            Sentry.captureException(error);
            logger_1.default.error("join_session error", { error, sessionId, userId });
            socket.emit("error", { message: "Failed to join session" });
        }
    });
    const processUserAnswer = async ({ sessionId, audioBuffer, mimeType }) => {
        if (!sessionId) {
            socket.emit("error", { message: "Missing sessionId" });
            return;
        }
        socket.emit("ai_thinking");
        const audio = normalizeToBuffer(audioBuffer);
        logger_1.default.info("user_answer received", {
            sessionId,
            userId,
            rawType: typeof audioBuffer,
            audioBytes: audio.length,
            mimeType,
        });
        // Ignore tiny blobs that commonly occur from accidental clicks or VAD tail.
        // These often fail STT ("corrupt or unsupported data") and cause the AI to repeat questions.
        const MIN_AUDIO_BYTES = 200;
        if (audio.length > 0 && audio.length < MIN_AUDIO_BYTES) {
            logger_1.default.info("Dropping tiny audio blob", { sessionId, userId, audioBytes: audio.length });
            return;
        }
        const session = await database_1.prisma.interviewSession.findFirst({
            where: { id: sessionId, userId },
            include: { persona: true, job: true },
        });
        if (!session) {
            socket.emit("error", { message: "Session not found or access denied" });
            return;
        }
        let transcript = "";
        if (audio.length) {
            const contentType = sanitizeAudioContentType(mimeType);
            transcript = await deepgram_service_1.deepgramService.transcribeAudio(audio, contentType);
        }
        if (!transcript?.trim() && audio.length) {
            socket.emit("ai_response", {
                text: "I couldn't hear that clearly. Please repeat your answer (or speak a bit louder).",
                audio: null,
            });
            return;
        }
        logger_1.default.info("Received user answer", {
            sessionId,
            userId,
            audioBytes: audio.length,
            transcriptLen: transcript.length,
        });
        // Persist user message so analysis can run even if LangGraph checkpointing fails.
        try {
            await database_1.prisma.interviewMessage.create({
                data: { sessionId, role: "user", content: transcript },
            });
        }
        catch (e) {
            logger_1.default.warn("Failed to persist user message", { sessionId, error: e });
        }
        const jobContext = session.job
            ? `Job Title: ${session.job.title}\nCompany: ${session.job.company}\nDescription: ${session.job.jobDescription}`
            : "";
        const personaContext = session.persona
            ? `You are ${session.persona.name}, ${session.persona.role} at ${session.persona.company}.\nInterview style: ${session.persona.interviewStyle}\nBackground: ${session.persona.background}`
            : "";
        const graph = await getGraph();
        const stream = await graph.stream({
            messages: [new messages_1.HumanMessage(transcript)],
            scenarioType: session.scenarioType,
            jobContext,
            personaContext,
        }, { configurable: { thread_id: sessionId }, streamMode: "messages" });
        let aiResponse = "";
        for await (const [message, metadata] of stream) {
            if (metadata.langgraph_node === "question" &&
                message.content &&
                !message.additional_kwargs?.tool_calls) {
                const text = String(message.content);
                const chunks = text.split(/(\s+)/).filter((c) => c.length > 0);
                for (const token of chunks) {
                    aiResponse += token;
                    socket.emit("ai_token", { token });
                }
            }
        }
        const finalText = aiResponse?.trim() || " ";
        // Persist assistant message for later feedback generation.
        try {
            await database_1.prisma.interviewMessage.create({
                data: { sessionId, role: "assistant", content: finalText },
            });
        }
        catch (e) {
            logger_1.default.warn("Failed to persist assistant message", { sessionId, error: e });
        }
        // Send text immediately (do not block on TTS).
        socket.emit("ai_response", { text: finalText, audio: null });
        // Generate audio in the background and send separately.
        deepgram_service_1.deepgramService
            .AudioToSpeech(finalText)
            .then((audio) => socket.emit("ai_audio", { audio }))
            .catch((e) => logger_1.default.warn("TTS failed", { sessionId, error: e }));
    };
    socket.on("user_answer", async (payload) => {
        const sessionId = payload?.sessionId;
        if (!sessionId) {
            socket.emit("error", { message: "Missing sessionId" });
            return;
        }
        if (inFlightBySessionId.has(sessionId)) {
            pendingBySessionId.set(sessionId, payload);
            logger_1.default.info("user_answer coalesced (in flight)", { sessionId, userId });
            return;
        }
        inFlightBySessionId.add(sessionId);
        try {
            await processUserAnswer(payload);
        }
        catch (error) {
            Sentry.captureException(error);
            logger_1.default.error("user_answer error", { error, sessionId, userId });
            socket.emit("error", { message: "Failed to process user answer" });
        }
        finally {
            inFlightBySessionId.delete(sessionId);
            const pending = pendingBySessionId.get(sessionId);
            if (pending) {
                pendingBySessionId.delete(sessionId);
                // Process one queued payload (latest wins) to keep the conversation linear.
                try {
                    inFlightBySessionId.add(sessionId);
                    await processUserAnswer(pending);
                }
                catch (error) {
                    Sentry.captureException(error);
                    logger_1.default.error("user_answer error (pending)", { error, sessionId, userId });
                    socket.emit("error", { message: "Failed to process user answer" });
                }
                finally {
                    inFlightBySessionId.delete(sessionId);
                }
            }
        }
    });
    socket.on("end_session", async ({ sessionId }) => {
        try {
            if (!sessionId) {
                socket.emit("error", { message: "Missing sessionId" });
                return;
            }
            await database_1.prisma.interviewSession.updateMany({
                where: { id: sessionId, userId },
                data: { status: "processing", endedAt: new Date() },
            });
            await session_analysis_queue_1.analysisQueue.add("analyze_session", { sessionId });
            io.to(sessionId).emit("session_ended", { sessionId });
            socket.leave(sessionId);
            logger_1.default.info("Session ended, feedback job enqueued", { sessionId, userId });
        }
        catch (error) {
            Sentry.captureException(error);
            logger_1.default.error("end_session error", { error, sessionId, userId });
            socket.emit("error", { message: "Failed to end session" });
        }
    });
    socket.on("leave_session", (sessionId) => {
        socket.leave(sessionId);
        logger_1.default.info("User left session", { sessionId, socketId: socket.id, userId });
    });
};
exports.registerSessionHandlers = registerSessionHandlers;
//# sourceMappingURL=session.handler.js.map