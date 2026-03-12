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
  PORT: z.coerce.number().default(8000),
  FRONTEND_URL: z.string(),
  SENTRY_DSN: z.string().optional(),

  SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),

  DATABASE_URL: z.string(),

  GEMINI_API_KEY: z.string(),
  GEMINI_MODEL: z.string().optional().default("gemini-2.5-flash"),
  GEMINI_API_VERSION: z.string().optional().default("v1beta"),

  DEEPGRAM_API_KEY: z.string(),

  LIVEKIT_URL: z.string(),
  LIVEKIT_API_KEY: z.string(),
  LIVEKIT_API_SECRET: z.string(),
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
