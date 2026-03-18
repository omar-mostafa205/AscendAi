"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.geminiGenerateContentWithRetry = geminiGenerateContentWithRetry;
const logger_1 = __importDefault(require("../../config/logger"));
class TimeoutError extends Error {
    constructor(message = "Timed out") {
        super(message);
        this.name = "TimeoutError";
    }
}
/**
 * Project requirement: no retry logic.
 * - Attempt exactly once (optionally with a timeout)
 * - If it fails and fallbackText exists, return fallbackText
 * - Never sleep/retry/circuit-break
 */
async function geminiGenerateContentWithRetry(generate, opts) {
    const timeoutMs = opts?.timeoutMs;
    try {
        const res = await (timeoutMs
            ? Promise.race([
                generate(),
                new Promise((_, reject) => setTimeout(() => reject(new TimeoutError()), timeoutMs)),
            ])
            : generate());
        return res.response.text();
    }
    catch (error) {
        const status = error?.status;
        const name = error?.name;
        logger_1.default.warn("Gemini failed; using fallback text", { status, name });
        if (opts?.fallbackText != null)
            return opts.fallbackText;
        throw error;
    }
}
//# sourceMappingURL=gemini-retry.js.map