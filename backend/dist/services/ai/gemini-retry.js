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
function parseRetryDelaySeconds(errorDetails) {
    if (!Array.isArray(errorDetails))
        return null;
    for (const item of errorDetails) {
        if (!item || typeof item !== "object")
            continue;
        const t = item["@type"];
        if (t === "type.googleapis.com/google.rpc.RetryInfo") {
            const raw = item.retryDelay;
            if (typeof raw === "string") {
                const m = raw.match(/^(\d+)(?:\.(\d+))?s$/);
                if (m)
                    return Number(m[1]) + (m[2] ? Number(`0.${m[2]}`) : 0);
            }
        }
    }
    return null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function geminiGenerateContentWithRetry(generate, opts) {
    const maxAttempts = opts?.maxAttempts ?? 3;
    const timeoutMs = opts?.timeoutMs;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
            lastError = error;
            const status = error?.status;
            const retryAfterSeconds = parseRetryDelaySeconds(error?.errorDetails) ??
                (typeof error?.message === "string"
                    ? (() => {
                        const m = error.message.match(/Please retry in\s+(\d+)(?:\.(\d+))?s/i);
                        if (!m)
                            return null;
                        return Number(m[1]) + (m[2] ? Number(`0.${m[2]}`) : 0);
                    })()
                    : null);
            // For local/dev reliability: if we're rate-limited and a fallback is available,
            // return it immediately instead of waiting and retrying.
            if (status === 429 && opts?.fallbackText) {
                logger_1.default.warn("Gemini rate-limited; using fallback immediately", { attempt, maxAttempts });
                return opts.fallbackText;
            }
            if (status === 429 && attempt < maxAttempts) {
                const waitMs = Math.min(Math.ceil(((retryAfterSeconds ?? 10) + 1) * 1000), 60000);
                logger_1.default.warn("Gemini rate-limited; retrying", { attempt, maxAttempts, waitMs });
                await sleep(waitMs);
                continue;
            }
            // If we've exhausted retries and a fallback is provided, return it instead of failing the flow.
            if (opts?.fallbackText) {
                logger_1.default.warn("Gemini failed; using fallback text", {
                    status,
                    name: error?.name,
                    attempt,
                    maxAttempts,
                });
                return opts.fallbackText;
            }
            throw error;
        }
    }
    if (opts?.fallbackText) {
        logger_1.default.warn("Gemini failed; using fallback text (after retries)");
        return opts.fallbackText;
    }
    throw lastError;
}
//# sourceMappingURL=gemini-retry.js.map