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
exports.endSessionById = exports.getSessionById = void 0;
const zod_1 = require("zod");
const Sentry = __importStar(require("@sentry/node"));
const logger_1 = __importDefault(require("../../config/logger"));
const database_1 = require("../../config/database");
const livekit_service_1 = require("../../services/voice/livekit.service");
const session_analysis_queue_1 = require("../../queues/session-analysis-queue");
const getSessionById = async (req, res) => {
    const sessionId = req.params.sessionId;
    if (!zod_1.z.string().uuid().safeParse(sessionId).success) {
        res.status(404).json({ error: "Session not found" });
        return;
    }
    try {
        const session = await database_1.prisma.interviewSession.findFirst({
            where: { id: sessionId, userId: req.user.id },
            include: { job: true },
        });
        if (!session) {
            res.status(404).json({ error: "Session not found" });
            return;
        }
        let livekitToken = null;
        try {
            livekitToken = await livekit_service_1.LivekitService.generateToken(session.id, req.user.id);
        }
        catch (e) {
            logger_1.default.warn("Failed to generate LiveKit token", { sessionId, error: e });
        }
        res.status(200).json({
            data: {
                id: session.id,
                userId: session.userId,
                jobId: session.jobId,
                personaId: session.personaId,
                scenarioType: session.scenarioType,
                status: session.status,
                overallScore: session.overallScore,
                feedback: session.feedback,
                startedAt: session.startedAt,
                endedAt: session.endedAt,
                createdAt: session.createdAt,
                job: session.job ? { title: session.job.title, company: session.job.company } : undefined,
                livekitToken,
            },
        });
    }
    catch (error) {
        Sentry.captureException(error, { extra: { sessionId, userId: req.user.id } });
        logger_1.default.error("Failed to fetch session", { error, sessionId, userId: req.user.id });
        res.status(500).json({ error: "Internal Server Error" });
    }
};
exports.getSessionById = getSessionById;
const endSessionById = async (req, res) => {
    const sessionId = req.params.sessionId;
    if (!zod_1.z.string().uuid().safeParse(sessionId).success) {
        res.status(404).json({ error: "Session not found" });
        return;
    }
    try {
        const existing = await database_1.prisma.interviewSession.findFirst({
            where: { id: sessionId, userId: req.user.id },
            select: { id: true, status: true },
        });
        if (!existing) {
            res.status(404).json({ error: "Session not found" });
            return;
        }
        // Idempotent end: if already completed/processing, just return 200.
        if (existing.status === "completed" || existing.status === "processing") {
            res.status(200).json({ data: { id: sessionId, status: existing.status } });
            return;
        }
        await database_1.prisma.interviewSession.updateMany({
            where: { id: sessionId, userId: req.user.id },
            data: { status: "processing", endedAt: new Date() },
        });
        await session_analysis_queue_1.analysisQueue.add("analyze_session", { sessionId });
        res.status(200).json({ data: { id: sessionId, status: "processing" } });
    }
    catch (error) {
        Sentry.captureException(error, { extra: { sessionId, userId: req.user.id } });
        logger_1.default.error("Failed to end session", { error, sessionId, userId: req.user.id });
        res.status(500).json({ error: "Internal Server Error" });
    }
};
exports.endSessionById = endSessionById;
//# sourceMappingURL=session.controller.js.map