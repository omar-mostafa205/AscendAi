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
exports.getLiveToken = exports.endSession = exports.getSession = exports.createSession = exports.getSessions = void 0;
const Sentry = __importStar(require("@sentry/node"));
const logger_1 = __importDefault(require("../../config/logger"));
const session_service_1 = require("./session.service");
const zod_1 = require("zod");
const createSessionSchema = zod_1.z.object({
    scenarioType: zod_1.z.enum(["technical", "background", "culture"]),
});
const sessionIdSchema = zod_1.z.string().uuid();
const liveTokenBodySchema = zod_1.z.object({
    scenarioType: zod_1.z.enum(["technical", "background", "culture"]).optional(),
});
const getSessions = async (req, res) => {
    try {
        const jobId = req.params.jobId;
        if (!zod_1.z.string().uuid().safeParse(jobId).success) {
            res.status(404).json({ error: "Job not found" });
            return;
        }
        const sessions = await session_service_1.sessionService.getSessions(jobId, req.user.id);
        res.status(200).json({ data: sessions });
    }
    catch (error) {
        if (error instanceof Error && error.message.startsWith("Job not found")) {
            res.status(404).json({ error: "Job not found" });
            return;
        }
        Sentry.captureException(error, { extra: { jobId: req.params.jobId } });
        logger_1.default.error("Failed to fetch sessions", { error, jobId: req.params.jobId });
        res.status(500).json({ error: "Internal Server Error" });
    }
};
exports.getSessions = getSessions;
const createSession = async (req, res) => {
    const jobId = req.params.jobId;
    if (!zod_1.z.string().uuid().safeParse(jobId).success) {
        res.status(404).json({ error: "Job not found" });
        return;
    }
    const validated = createSessionSchema.safeParse(req.body);
    if (!validated.success) {
        res.status(400).json({ error: validated.error.flatten().fieldErrors });
        return;
    }
    try {
        const session = await session_service_1.sessionService.createSession(req.user.id, jobId, validated.data.scenarioType);
        res.status(201).json({ data: session });
    }
    catch (error) {
        if (error instanceof Error && error.message.startsWith("Job not found")) {
            res.status(404).json({ error: "Job not found" });
            return;
        }
        Sentry.captureException(error, { extra: { userId: req.user.id, jobId: req.params.jobId } });
        logger_1.default.error("Failed to create session", { error, userId: req.user.id, jobId: req.params.jobId });
        res.status(500).json({ error: "Internal Server Error" });
    }
};
exports.createSession = createSession;
const getSession = async (req, res) => {
    const sessionId = req.params.id;
    if (!sessionIdSchema.safeParse(sessionId).success) {
        res.status(404).json({ error: "Session not found" });
        return;
    }
    try {
        const session = await session_service_1.sessionService.getSession(sessionId, req.user.id);
        res.status(200).json({ data: session });
    }
    catch (error) {
        logger_1.default.error("Failed to get session", { error, userId: req.user.id, sessionId });
        if (error instanceof Error && error.message.startsWith("Session not found")) {
            res.status(404).json({ error: "Session not found" });
            return;
        }
        Sentry.captureException(error, { extra: { userId: req.user.id, sessionId } });
        res.status(500).json({ error: "Internal Server Error" });
    }
};
exports.getSession = getSession;
const endSession = async (req, res) => {
    const sessionId = req.params.id;
    if (!sessionIdSchema.safeParse(sessionId).success) {
        res.status(404).json({ error: "Session not found" });
        return;
    }
    try {
        const result = await session_service_1.sessionService.endSession(sessionId, req.user.id);
        res.status(200).json({ data: result });
    }
    catch (error) {
        logger_1.default.error("Failed to end session", { error, userId: req.user.id, sessionId });
        if (error instanceof Error && error.message.startsWith("Session not found")) {
            res.status(404).json({ error: "Session not found" });
            return;
        }
        Sentry.captureException(error, { extra: { userId: req.user.id, sessionId } });
        res.status(500).json({ error: "Internal Server Error" });
    }
};
exports.endSession = endSession;
const getLiveToken = async (req, res) => {
    const sessionId = req.params.id;
    if (!sessionIdSchema.safeParse(sessionId).success) {
        res.status(404).json({ error: "Session not found" });
        return;
    }
    const validated = liveTokenBodySchema.safeParse(req.query);
    if (!validated.success) {
        res.status(400).json({ error: validated.error.flatten().fieldErrors });
        return;
    }
    try {
        const tokenData = await session_service_1.sessionService.getLiveToken(sessionId, req.user.id, validated.data.scenarioType);
        res.status(200).json({ data: tokenData });
    }
    catch (error) {
        logger_1.default.error("Failed to get live token", { error, userId: req.user.id, sessionId });
        if (error instanceof Error &&
            (error.message.startsWith("Session not found") || error.message === "Session job not found")) {
            res.status(404).json({ error: "Session not found" });
            return;
        }
        Sentry.captureException(error, { extra: { userId: req.user.id, sessionId } });
        res.status(500).json({ error: "Internal Server Error" });
    }
};
exports.getLiveToken = getLiveToken;
//# sourceMappingURL=session.controller.js.map