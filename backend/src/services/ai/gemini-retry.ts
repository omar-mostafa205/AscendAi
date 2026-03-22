import logger from "../../config/logger"

class TimeoutError extends Error {
  constructor(message = "Timed out") {
    super(message)
    this.name = "TimeoutError"
  }
}

export async function geminiGenerateContentWithRetry(
  generate: () => Promise<{ response: { text: () => string } }>,
  opts?: { fallbackText?: string; timeoutMs?: number; maxAttempts?: number }
): Promise<string> {
  const timeoutMs = opts?.timeoutMs

  try {
    const res = await (timeoutMs
      ? Promise.race([
          generate(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new TimeoutError()), timeoutMs)),
        ])
      : generate())

    return res.response.text()
  } catch (error: any) {
    const status = error?.status
    const name = error?.name
    logger.warn("Gemini failed; using fallback text", { status, name })

    if (opts?.fallbackText != null) return opts.fallbackText
    throw error
  }
}

