import { createClient } from "@supabase/supabase-js"
import { env } from "./env"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchWithTimeoutAndRetry(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
): Promise<Response> {
  const timeoutMs = 30000
  const attempts = 2

  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(input, { ...init, signal: controller.signal })
      clearTimeout(t)
      return res
    } catch (e) {
      clearTimeout(t)
      lastError = e
      if (i < attempts - 1) await sleep(250)
    }
  }
  throw lastError
}

export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    global: { fetch: fetchWithTimeoutAndRetry },
    auth: { persistSession: false },
  }
)
