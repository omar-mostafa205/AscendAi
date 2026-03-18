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
const database_1 = require("../../config/database");
const logger_1 = __importDefault(require("../../config/logger"));
const Sentry = __importStar(require("@sentry/node"));
const feedback_prompt_1 = require("../../services/ai/prompts/feedback.prompt");
const redis_1 = require("../../config/redis");
const startSessionWorker = async () => {
    const worker = new bullmq_1.Worker("session-analysis", async (job) => {
        const { sessionId } = job.data;
        const session = await database_1.prisma.interviewSession.findUnique({
            where: { id: sessionId },
            select: {
                messages: {
                    orderBy: { createdAt: "asc" },
                    select: {
                        content: true,
                        role: true,
                    },
                },
                scenarioType: true,
            },
        });
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        if (!session.messages || session.messages.length === 0) {
            logger_1.default.warn("No messages found for session", { sessionId });
            return null;
        }
        const feedback = await createSessionFeedback(session.messages, session.scenarioType);
        await database_1.prisma.interviewSession.update({
            where: { id: sessionId },
            data: {
                feedback,
                status: "completed"
            },
        });
        logger_1.default.info("Session analysis complete", {
            sessionId,
            jobId: job.id
        });
        return feedback;
    }, {
        // Use the same Redis connection config as the Queue (supports Upstash/rediss).
        connection: redis_1.redisQueue.options,
    });
    worker.on("completed", (job) => {
        logger_1.default.info("Job completed", {
            service: "AscendAI",
            jobId: job.id
        });
    });
    worker.on("failed", (job, error) => {
        Sentry.captureException(error, {
            extra: {
                jobId: job?.id,
                sessionId: job?.data?.sessionId
            },
        });
        logger_1.default.error("Job failed", {
            service: "AscendAI",
            jobId: job?.id,
            error
        });
    });
};
exports.startSessionWorker = startSessionWorker;
const createSessionFeedback = async (conversation, scenarioType) => {
    try {
        const conversationText = conversation
            .map((msg) => `${msg.role}: ${msg.content}`)
            .join("\n");
        const feedback = (0, feedback_prompt_1.buildFeedbackPrompt)(conversationText, scenarioType);
        return feedback;
    }
    catch (error) {
        logger_1.default.error("Failed to create session feedback", {
            service: "AscendAI",
            error
        });
        throw error;
    }
};
//# sourceMappingURL=session-analysis.worker.js.map