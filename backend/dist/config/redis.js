"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisQueue = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
const logger_1 = __importDefault(require("./logger"));
exports.redisQueue = new ioredis_1.default(env_1.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    // Make initial connect and reconnect a bit more resilient on flaky networks.
    connectTimeout: 15000,
    keepAlive: 30000,
    retryStrategy: (times) => {
        if (times > 10) {
            logger_1.default.error("Redis connection failed after 10 retries");
            return null;
        }
        // Exponential-ish backoff with a small cap.
        return Math.min(200 + times * 250, 5000);
    },
});
logger_1.default.info("Redis configured", {
    host: exports.redisQueue.options.host,
    port: exports.redisQueue.options.port,
    tls: !!exports.redisQueue.options.tls,
});
exports.redisQueue.on("ready", () => logger_1.default.info("Redis ready"));
exports.redisQueue.on("reconnecting", (time) => logger_1.default.warn("Redis reconnecting", { time }));
exports.redisQueue.on("end", () => logger_1.default.warn("Redis connection ended"));
exports.redisQueue.on("error", (err) => logger_1.default.error("Redis error", { error: err?.message ?? String(err) }));
//# sourceMappingURL=redis.js.map