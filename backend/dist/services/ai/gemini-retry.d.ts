export declare function geminiGenerateContentWithRetry(generate: () => Promise<{
    response: {
        text: () => string;
    };
}>, opts?: {
    maxAttempts?: number;
    fallbackText?: string;
    timeoutMs?: number;
}): Promise<string>;
