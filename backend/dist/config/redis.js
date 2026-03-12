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
    retryStrategy: (times) => {
        if (times > 10) {
            logger_1.default.error("Redis connection failed after 10 retries");
            return null;
        }
        return Math.min(times * 50, 2000);
    },
});
exports.redisQueue.on("ready", () => logger_1.default.info("Redis ready"));
exports.redisQueue.on("error", (err) => logger_1.default.error("Redis error", { error: err.message }));
//# sourceMappingURL=redis.js.map