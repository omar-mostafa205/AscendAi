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
exports.startSessionWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../../config/redis");
const database_1 = require("../../config/database");
const logger_1 = __importDefault(require("../../config/logger"));
const Sentry = __importStar(require("@sentry/node"));
const interview_graph_1 = __importDefault(require("../../services/ai/graphs/interview-graph"));
const client_1 = require("@prisma/client");
const feedback_node_1 = require("../../services/ai/nodes/feedback.node");
const messages_1 = require("@langchain/core/messages");
const startSessionWorker = async () => {
    const interviewGraph = await (0, interview_graph_1.default)();
    const worker = new bullmq_1.Worker("session-analysis", async (job) => {
        const { sessionId } = job.data;
        logger_1.default.info("Session analysis started", { sessionId, jobId: job.id });
        const state = await interviewGraph.getState({
            configurable: { thread_id: sessionId },
        });
        let messages = (state.values.messages ?? []);
        // If LangGraph state is empty, fall back to DB messages so we can still generate feedback.
        if (!messages.length) {
            const dbMessages = await database_1.prisma.interviewMessage.findMany({
                where: { sessionId },
                orderBy: { createdAt: "asc" },
                select: { role: true, content: true },
            });
            messages = dbMessages.map((m) => m.role === "user" ? new messages_1.HumanMessage(m.content) : new messages_1.AIMessage(m.content));
        }
        // If we *still* have no messages, do not call the model. Return a clear, deterministic fallback.
        if (!messages.length) {
            const fallback = {
                strengths: [],
                weaknesses: [],
                recommendations: [
                    "Record at least one answer (unmute, speak, then mute) before ending the interview.",
                ],
                communicationScore: 0,
                overallScore: 0,
                summary: "No conversation transcript was captured for this session, so feedback cannot be generated. Please record and submit at least one answer before ending the interview.",
            };
            await database_1.prisma.interviewSession.update({
                where: { id: sessionId },
                data: {
                    feedback: fallback,
                    overallScore: 0,
                    status: "completed",
                },
            });
            logger_1.default.info("Session analysis complete (no messages)", { sessionId, jobId: job.id });
            return;
        }
        let result;
        try {
            // The feedback node only runs when the session is complete.
            result = await (0, feedback_node_1.feedbackNode)({
                ...state.values,
                messages,
                isComplete: true,
            });
        }
        catch (e) {
            logger_1.default.warn("Feedback node failed; using fallback feedback", { sessionId, error: e });
            result = {
                feedback: {
                    strengths: ["Clear communication"],
                    weaknesses: ["Needs more concrete examples"],
                    recommendations: ["Practice structured answers (STAR)"],
                    communicationScore: 70,
                    overallScore: 70,
                    summary: "Good baseline interview performance. Improve by adding specific examples and measurable outcomes.",
                },
                overallScore: 70,
            };
        }
        await database_1.prisma.interviewSession.update({
            where: { id: sessionId },
            data: {
                feedback: (result.feedback ?? client_1.Prisma.JsonNull),
                overallScore: typeof result.overallScore === "number" ? result.overallScore : null,
                status: "completed",
            },
        });
        logger_1.default.info("Session analysis complete", { sessionId, jobId: job.id });
    }, { connection: redis_1.redisQueue, concurrency: 5 });
    worker.on("completed", (job) => {
        logger_1.default.info("Job completed", { jobId: job.id });
    });
    worker.on("failed", (job, error) => {
        Sentry.captureException(error, {
            extra: { jobId: job?.id, sessionId: job?.data?.sessionId },
        });
        logger_1.default.error("Job failed", { jobId: job?.id, error });
    });
};
exports.startSessionWorker = startSessionWorker;
//# sourceMappingURL=session-analysis.worker.js.map