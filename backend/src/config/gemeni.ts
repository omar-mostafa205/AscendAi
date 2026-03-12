import {GoogleGenerativeAI} from "@google/generative-ai"
import {env} from "./env"

const genAi = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const modelName = env.GEMINI_MODEL.replace(/^models\//, "")
export const model = genAi.getGenerativeModel(
  { model: modelName },
  { apiVersion: env.GEMINI_API_VERSION, timeout: 30000 }
);
