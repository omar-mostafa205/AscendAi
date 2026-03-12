"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
exports.analysisQueue = new bullmq_1.Queue("session-analysis", {
    connection: redis_1.redisQueue.options,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000,
        },
    },
});
//# sourceMappingURL=session-analysis-queue.js.map