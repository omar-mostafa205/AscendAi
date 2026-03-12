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
exports.createJob = exports.getJobById = exports.getJobs = void 0;
const Sentry = __importStar(require("@sentry/node"));
const logger_1 = __importDefault(require("../../config/logger"));
const job_service_1 = __importDefault(require("./job.service"));
const zod_1 = require("zod");
const createJobSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(100),
    company: zod_1.z.string().min(2).max(100),
    jobDescription: zod_1.z.string().min(50).max(5000),
});
const getJobs = async (req, res) => {
    try {
        const jobs = await job_service_1.default.getJobs(req.user.id);
        res.status(200).json({ data: jobs });
    }
    catch (error) {
        Sentry.captureException(error, { extra: { userId: req.user.id } });
        logger_1.default.error("Failed to fetch jobs", { error, userId: req.user.id });
        res.status(500).json({ error: "Internal Server Error" });
    }
};
exports.getJobs = getJobs;
const getJobById = async (req, res) => {
    try {
        const job = await job_service_1.default.getJobById(req.params.id, req.user.id);
        res.status(200).json({ data: job });
    }
    catch (error) {
        if (error instanceof Error && error.message === "Job not found") {
            res.status(404).json({ error: "Job not found" });
            return;
        }
        Sentry.captureException(error, { extra: { userId: req.user.id, jobId: req.params.id } });
        logger_1.default.error("Failed to fetch job", { error, userId: req.user.id, jobId: req.params.id });
        res.status(500).json({ error: "Internal Server Error" });
    }
};
exports.getJobById = getJobById;
const createJob = async (req, res) => {
    const validated = createJobSchema.safeParse(req.body);
    if (!validated.success) {
        res.status(400).json({ error: validated.error.flatten().fieldErrors });
        return;
    }
    try {
        const job = await job_service_1.default.createJob({
            userId: req.user.id,
            ...validated.data,
        });
        res.status(201).json({ data: job });
    }
    catch (error) {
        Sentry.captureException(error, { extra: { userId: req.user.id } });
        logger_1.default.error("Failed to create job", { error, userId: req.user.id });
        res.status(500).json({ error: "Internal Server Error" });
    }
};
exports.createJob = createJob;
//# sourceMappingURL=job.controller.js.map