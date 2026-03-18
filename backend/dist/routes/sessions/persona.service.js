"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.personaService = void 0;
const database_1 = require("../../config/database");
const gemini_1 = require("../../config/gemini");
const logger_1 = __importDefault(require("../../config/logger"));
const persona_prompt_1 = require("../../services/ai/prompts/persona.prompt");
const gemini_retry_1 = require("../../services/ai/gemini-retry");
async function parsePersonaResponse(text) {
    const clean = text.trim().replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
}
async function generatePersona(job, scenarioType) {
    const prompt = (0, persona_prompt_1.buildPersonaCreationPrompt)(job, scenarioType);
    const text = await (0, gemini_retry_1.geminiGenerateContentWithRetry)(() => gemini_1.model.generateContent(prompt));
    const generated = await parsePersonaResponse(text);
    logger_1.default.info("Persona generated", { jobId: job.id, scenarioType });
    return database_1.prisma.persona.create({
        data: {
            jobId: job.id,
            type: scenarioType,
            ...generated,
        },
    });
}
async function findExistingPersona(jobId, scenarioType) {
    return database_1.prisma.persona.findUnique({
        where: {
            jobId_type: { jobId, type: scenarioType },
        },
    });
}
async function getOrCreatePersona(job, scenarioType) {
    const existing = await findExistingPersona(job.id, scenarioType);
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
exports.personaService = {
    getOrCreatePersona,
};
//# sourceMappingURL=persona.service.js.map