/**
 * Project requirement: no retry logic.
 * - Attempt exactly once (optionally with a timeout)
 * - If it fails and fallbackText exists, return fallbackText
 * - Never sleep/retry/circuit-break
 */
export declare function geminiGenerateContentWithRetry(generate: () => Promise<{
    response: {
        text: () => string;
    };
}>, opts?: {
    fallbackText?: string;
    timeoutMs?: number;
    maxAttempts?: number;
}): Promise<string>;
