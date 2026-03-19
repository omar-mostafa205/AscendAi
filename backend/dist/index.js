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
const server_1 = require("./server");
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const logger_1 = __importDefault(require("./config/logger"));
const sentry_1 = require("./config/sentry");
const Sentry = __importStar(require("@sentry/node"));
const session_analysis_worker_1 = require("./queues/workers/session-analysis.worker");
const env_1 = require("./config/env");
// If you pipe `npm run dev | rg ...` and then stop `rg`, Node can crash with EPIPE
// when writing to a closed stdout/stderr. Swallow it to keep dev experience stable.
for (const s of [process.stdout, process.stderr]) {
    s.on("error", (err) => {
        if (err?.code === "EPIPE")
            process.exit(0);
    });
}
async function bootstrap() {
    try {
        (0, sentry_1.initSentry)();
        await (0, database_1.connectDb)();
        await redis_1.redisQueue.ping();
        logger_1.default.info("Redis connected");
        const { app, server, io } = (0, server_1.createServer)();
        await (0, session_analysis_worker_1.startSessionWorker)();
        const PORT = env_1.env.PORT || 8001;
        server.listen(PORT, () => {
            logger_1.default.info("Server started", {
                port: PORT,
                environment: env_1.env.NODE_ENV,
            });
        });
        const shutdown = async (signal) => {
            logger_1.default.info(`${signal} received, shutting down gracefully...`);
            server.close(() => logger_1.default.info("HTTP server closed"));
            io.close(() => logger_1.default.info("WebSocket server closed"));
            await redis_1.redisQueue.quit();
            await Sentry.close(2000);
            await (0, database_1.disconnectDb)();
            process.exit(0);
        };
        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));
    }
    catch (error) {
        logger_1.default.error("Failed to start server", {
            error: error instanceof Error ? error.message : "Unknown error",
        });
        Sentry.captureException(error, { tags: { phase: "startup" } });
        await Sentry.close(2000);
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=index.js.map