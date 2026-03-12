"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.env = exports.envSchema = void 0;
const zod_1 = require("zod");
const logger_1 = __importDefault(require("./logger"));
const dotenv_1 = __importDefault(require("dotenv"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const envCandidates = [
    node_path_1.default.resolve(process.cwd(), ".env"),
    node_path_1.default.resolve(process.cwd(), "..", ".env"),
];
for (const p of envCandidates) {
    if (node_fs_1.default.existsSync(p)) {
        dotenv_1.default.config({ path: p });
        break;
    }
}
exports.envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]),
    PORT: zod_1.z.coerce.number().default(8000),
    FRONTEND_URL: zod_1.z.string(),
    SENTRY_DSN: zod_1.z.string().optional(),
    SUPABASE_URL: zod_1.z.string(),
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z.string(),
    DATABASE_URL: zod_1.z.string(),
    GEMINI_API_KEY: zod_1.z.string(),
    GEMINI_MODEL: zod_1.z.string().optional().default("gemini-2.5-flash"),
    GEMINI_API_VERSION: zod_1.z.string().optional().default("v1beta"),
    DEEPGRAM_API_KEY: zod_1.z.string(),
    LIVEKIT_URL: zod_1.z.string(),
    LIVEKIT_API_KEY: zod_1.z.string(),
    LIVEKIT_API_SECRET: zod_1.z.string(),
    REDIS_URL: zod_1.z.string(),
});
const validateEnv = () => {
    const parsed = exports.envSchema.safeParse(process.env);
    if (!parsed.success) {
        logger_1.default.error(parsed.error);
        process.exit(1);
    }
    return parsed.data;
};
exports.env = validateEnv();
exports.config = {
    isProduction: exports.env.NODE_ENV === "production",
    isDevlopment: exports.env.NODE_ENV === "development",
};
//# sourceMappingURL=env.js.map