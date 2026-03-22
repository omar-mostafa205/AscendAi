import { z } from "zod"
import logger from "./logger"
import dotenv from "dotenv"
import fs from "node:fs"
import path from "node:path"


const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", ".env"),
]
for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p })
    break
  }
}

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  // Local dev defaults to 8001 (matches docs/tests); in production Railway injects `PORT`.
  PORT: z.coerce.number().default(8001),
  // Comma-separated allowlist; can be empty to allow all (auth still protects the API).
  FRONTEND_URL: z.string().optional().default(""),
  SENTRY_DSN: z.string().optional(),

  SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),

  DATABASE_URL: z.string(),

  GEMINI_LIVE_MODEL: z.string().optional().default("gemini-2.0-flash-live-001"), 
  GEMINI_API_KEY: z.string(),
  GEMINI_MODEL: z.string().optional().default("gemini-2.5-flash"),
  GEMINI_API_VERSION: z.string().optional().default("v1beta"),
  REDIS_URL: z.string(),
})
const validateEnv = () => {
        const parsed = envSchema.safeParse(process.env)
        if(!parsed.success) {
           logger.error(parsed.error)
           process.exit(1)  
        }
        return parsed.data
}
export const env = validateEnv()

export const config = {
isProduction: env.NODE_ENV === "production",
isDevlopment: env.NODE_ENV === "development",

};
