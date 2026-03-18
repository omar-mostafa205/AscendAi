"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionService = void 0;
const database_1 = require("../../config/database");
const logger_1 = __importDefault(require("../../config/logger"));
const genai_1 = require("@google/genai");
const env_1 = require("../../config/env");
const persona_service_1 = require("./persona.service");
const live_prompt_1 = require("../../services/ai/prompts/live.prompt");
const session_analysis_queue_1 = require("../../queues/session-analysis-queue");
async function createSession(userId, jobId, scenarioType) {
    const job = await database_1.prisma.job.findFirst({
        where: { id: jobId, userId },
    });
    if (!job)
        throw new Error(`Job not found: ${jobId}`);
    const persona = await persona_service_1.personaService.getOrCreatePersona(job, scenarioType);
    const session = await database_1.prisma.interviewSession.create({
        data: {
            userId,
            jobId,
            personaId: persona.id,
            scenarioType,
            status: "in_progress",
        },
    });
    return { session };
}
async function listSessions(jobId) {
    const sessions = await database_1.prisma.interviewSession.findMany({
        where: { jobId },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            scenarioType: true,
            status: true,
            createdAt: true,
            overallScore: true,
            feedback: true,
        },
    });
    return sessions.map((session) => ({
        ...session,
        score: session.overallScore,
    }));
}
async function getSessions(jobId, userId) {
    const job = await database_1.prisma.job.findFirst({
        where: { id: jobId, userId },
        select: { id: true },
    });
    if (!job)
        throw new Error(`Job not found: ${jobId}`);
    return listSessions(jobId);
}
async function getSession(sessionId, userId) {
    const session = await database_1.prisma.interviewSession.findFirst({
        where: { id: sessionId, userId },
        select: {
            id: true,
            scenarioType: true,
            status: true,
            startedAt: true,
            endedAt: true,
            job: {
                select: {
                    title: true,
                    company: true,
                },
            },
        },
    });
    if (!session)
        throw new Error(`Session not found: ${sessionId}`);
    return session;
}
async function endSession(sessionId, userId) {
    const session = await database_1.prisma.interviewSession.findFirst({
        where: { id: sessionId, userId },
        select: { id: true, status: true },
    });
    if (!session)
        throw new Error(`Session not found: ${sessionId}`);
    if (session.status === "completed" || session.status === "processing") {
        return { id: sessionId, status: session.status };
    }
    await database_1.prisma.interviewSession.updateMany({
        where: { id: sessionId, userId },
        data: {
            status: "processing",
            endedAt: new Date(),
        },
    });
    try {
        await session_analysis_queue_1.analysisQueue.add("analyze_session", { sessionId });
    }
    catch (queueError) {
        logger_1.default.error("Failed to enqueue analysis job (API end)", { sessionId, userId, error: queueError });
    }
    return { id: sessionId, status: "processing" };
}
async function getLiveToken(sessionId, userId, scenarioType) {
    const session = await database_1.prisma.interviewSession.findFirst({
        where: { id: sessionId, userId },
        select: {
            id: true,
            scenarioType: true,
            personaId: true,
            jobId: true,
            job: true,
            persona: true,
        },
    });
    if (!session)
        throw new Error(`Session not found: ${sessionId}`);
    const resolvedScenarioType = (scenarioType ?? session.scenarioType);
    if (!["technical", "background", "culture"].includes(resolvedScenarioType)) {
        throw new Error("Invalid scenarioType");
    }
    const job = session.job;
    if (!job)
        throw new Error("Session job not found");
    const persona = session.persona ?? (await persona_service_1.personaService.getOrCreatePersona(job, resolvedScenarioType));
    if (!session.personaId && persona?.id) {
        try {
            await database_1.prisma.interviewSession.updateMany({
                where: { id: sessionId, userId },
                data: { personaId: persona.id },
            });
        }
        catch (e) {
            logger_1.default.warn("Failed to backfill personaId on session", { sessionId, userId, error: e });
        }
    }
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const client = new genai_1.GoogleGenAI({
        apiKey: env_1.env.GEMINI_API_KEY,
        httpOptions: { apiVersion: "v1alpha" },
    });
    const systemPrompt = (0, live_prompt_1.buildLiveInterviewPrompt)(job, persona, resolvedScenarioType);
    const token = await client.authTokens.create({
        config: {
            uses: 1,
            expireTime,
            liveConnectConstraints: {
                model: env_1.env.GEMINI_LIVE_MODEL,
                config: {
                    systemInstruction: systemPrompt,
                    responseModalities: [genai_1.Modality.AUDIO],
                    sessionResumption: {},
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: "Aoede" },
                        },
                    },
                },
            },
            httpOptions: { apiVersion: "v1alpha" },
        },
    });
    if (!token?.name) {
        throw new Error("Failed to create live token");
    }
    return { token: token.name, model: env_1.env.GEMINI_LIVE_MODEL };
}
exports.sessionService = {
    createSession,
    getSessions,
    getSession,
    endSession,
    getLiveToken,
};
//# sourceMappingURL=session.service.js.map