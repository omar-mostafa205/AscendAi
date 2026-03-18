import { GoogleGenerativeAI } from "@google/generative-ai"
import { env } from "./env"

const genAi = new GoogleGenerativeAI(env.GEMINI_API_KEY)

const MODEL_NAME = env.GEMINI_MODEL.replace(/^models\//, "")

export const model = genAi.getGenerativeModel(
  { model: MODEL_NAME },
  { apiVersion: "v1beta", timeout: 30000 }
)