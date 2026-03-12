"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.model = void 0;
const generative_ai_1 = require("@google/generative-ai");
const env_1 = require("./env");
const genAi = new generative_ai_1.GoogleGenerativeAI(env_1.env.GEMINI_API_KEY);
const modelName = env_1.env.GEMINI_MODEL.replace(/^models\//, "");
exports.model = genAi.getGenerativeModel({ model: modelName }, { apiVersion: env_1.env.GEMINI_API_VERSION, timeout: 30000 });
//# sourceMappingURL=gemeni.js.map