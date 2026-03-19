"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../../config/database");
const logger_1 = __importDefault(require("../../config/logger"));
const createJob = async ({ userId, title, company, jobDescription }) => {
    const job = await database_1.prisma.job.create({
        data: {
            userId,
            title,
            company,
            jobDescription
        },
    });
    logger_1.default.info("Job created", { userId, jobId: job.id });
    return job;
};
const getJobs = async (userId) => {
    const jobs = await database_1.prisma.job.findMany({
        where: { userId },
        select: {
            id: true,
            userId: true,
            title: true,
            company: true,
            jobDescription: true,
            createdAt: true,
        },
        orderBy: { createdAt: "desc" },
    });
    logger_1.default.info("Jobs fetched", { userId, count: jobs.length });
    return jobs;
};
const getJobById = async (jobId, userId) => {
    const job = await database_1.prisma.job.findUnique({
        where: { id: jobId },
        select: {
            id: true,
            userId: true,
            title: true,
            company: true,
            jobDescription: true,
            createdAt: true,
        },
    });
    logger_1.default.info("Jobs fetched", { userId });
    if (!job) {
        logger_1.default.warn("Job not found", { jobId, userId });
        throw new Error("Job not found");
    }
    return job;
};
exports.default = {
    getJobs,
    getJobById,
    createJob,
};
//# sourceMappingURL=job.service.js.map