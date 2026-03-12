"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionService = void 0;
// session.service.ts
const database_1 = require("../../config/database");
const gemeni_1 = require("../../config/gemeni");
const logger_1 = __importDefault(require("../../config/logger"));
const interview_graph_1 = __importDefault(require("../../services/ai/graphs/interview-graph"));
const persona_prompt_1 = require("../../services/ai/prompts/persona.prompt");
const livekit_service_1 = require("../../services/voice/livekit.service");
const gemini_retry_1 = require("../../services/ai/gemini-retry");
// Private helper functions (not exported)
// ============================================================================
async function generatePersona(job, scenarioType) {
    const prompt = (0, persona_prompt_1.buildPersonaCreationPrompt)(job, scenarioType);
    const fallbackPersona = {
        name: "Alex Morgan",
        role: scenarioType === "technical" ? "Engineering Manager" : "Hiring Manager",
        company: job.company,
        background: "Experienced interviewer focused on evaluating role-relevant skills and communication clarity.",
        interviewStyle: "Friendly, structured, and probing with follow-up questions when needed.",
        openessLevel: "medium",
        conscientiousnessLevel: "high",
        extraversionLevel: "medium",
        agreeablenessLevel: "high",
        neuroticismLevel: "low",
    };
    const text = (await (0, gemini_retry_1.geminiGenerateContentWithRetry)(() => gemeni_1.model.generateContent(prompt), {
        fallbackText: JSON.stringify(fallbackPersona),
    })).trim();
    const clean = text.replace(/```json|```/g, "").trim();
    let generated = fallbackPersona;
    try {
        generated = JSON.parse(clean);
    }
    catch {
        generated = fallbackPersona;
    }
    logger_1.default.info("Persona generated", { jobId: job.id, scenarioType });
    return database_1.prisma.persona.create({
        data: {
            jobId: job.id,
            type: scenarioType,
            name: generated.name,
            role: generated.role,
            company: generated.company,
            background: generated.background,
            interviewStyle: generated.interviewStyle,
            openessLevel: generated.openessLevel,
            conscientiousnessLevel: generated.conscientiousnessLevel,
            extraversionLevel: generated.extraversionLevel,
            agreeablenessLevel: generated.agreeablenessLevel,
            neuroticismLevel: generated.neuroticismLevel,
        },
    });
}
async function getPersona(job, scenarioType) {
    const existing = await database_1.prisma.persona.findUnique({
        where: {
            jobId_type: { jobId: job.id, type: scenarioType },
        },
    });
    if (existing) {
        logger_1.default.info("Reusing existing persona", {
            personaId: existing.id,
            jobId: job.id,
            scenarioType,
        });
        return existing;
    }
    return generatePersona(job, scenarioType);
}
async function createSession(userId, jobId, scenarioType) {
    const job = await database_1.prisma.job.findFirst({
        where: { id: jobId, userId },
    });
    if (!job)
        throw new Error(`Job not found: ${jobId}`);
    const persona = await getPersona(job, scenarioType);
    const session = await database_1.prisma.interviewSession.create({
        data: {
            userId,
            jobId,
            personaId: persona.id,
            scenarioType,
            status: "in_progress",
        },
    });
    try {
        await livekit_service_1.LivekitService.createRoom(session.id);
    }
    catch (e) {
        logger_1.default.warn("Livekit room creation failed; continuing without hard-failing session creation", {
            sessionId: session.id,
            error: e,
        });
    }
    const livekitToken = await livekit_service_1.LivekitService.generateToken(session.id, userId);
    // Best-effort: initialize the LangGraph checkpoint state without running the full graph.
    try {
        const graph = await (0, interview_graph_1.default)();
        await graph.updateState({ configurable: { thread_id: session.id } }, {
            messages: [],
            questionCount: 0,
            maxQuestions: 8,
            isComplete: false,
            scenarioType,
            feedback: null,
            overallScore: null,
            jobContext: `Job Title: ${job.title}\nCompany: ${job.company}\nDescription: ${job.jobDescription}`,
            personaContext: `You are ${persona.name}, ${persona.role} at ${persona.company}.\nInterview style: ${persona.interviewStyle}\nBackground: ${persona.background}`,
        });
    }
    catch (e) {
        logger_1.default.warn("LangGraph state init failed; will initialize on first socket turn", {
            sessionId: session.id,
            error: e,
        });
    }
    logger_1.default.info("Session created", { sessionId: session.id, userId, jobId });
    return { session, livekitToken };
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
exports.sessionService = {
    createSession,
    getSessions,
};
//# sourceMappingURL=session.service.js.map