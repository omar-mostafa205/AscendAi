"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFeedbackPrompt = exports.feedbackNode = void 0;
const gemeni_1 = require("../../../config/gemeni");
const background_prompt_1 = require("../prompts/background.prompt");
const culture_prompt_1 = require("../prompts/culture.prompt");
const technical_prompt_1 = require("../prompts/technical.prompt");
const messages_1 = require("@langchain/core/messages");
const gemini_retry_1 = require("../gemini-retry");
const feedbackNode = async (state) => {
    if (!state.isComplete) {
        return {};
    }
    const fallbackJson = JSON.stringify({
        strengths: ["Clear structure in responses", "Good communication under pressure"],
        weaknesses: ["Could add more concrete examples", "Could be more concise in parts"],
        recommendations: [
            "Practice answering with the STAR framework",
            "Add metrics and outcomes when describing projects",
        ],
        communicationScore: 75,
        technicalScore: state.scenarioType === "technical" ? 70 : undefined,
        problemSolvingScore: state.scenarioType === "technical" ? 68 : undefined,
        overallScore: 72,
        summary: "Solid baseline performance with clear communication. Improve by adding concrete examples and tightening answers.",
    }, null, 2);
    const text = await (0, gemini_retry_1.geminiGenerateContentWithRetry)(() => gemeni_1.model.generateContent((0, exports.buildFeedbackPrompt)(state)), { fallbackText: fallbackJson });
    let parsed = null;
    try {
        parsed = JSON.parse(String(text).replace(/```json|```/g, "").trim());
    }
    catch {
        parsed = null;
    }
    const feedback = parsed && typeof parsed === "object" ? parsed : null;
    const overallScore = feedback && typeof feedback.overallScore === "number" ? feedback.overallScore : null;
    return {
        messages: [new messages_1.AIMessage(text)],
        feedback,
        overallScore,
    };
};
exports.feedbackNode = feedbackNode;
const buildFeedbackPrompt = (state) => {
    switch (state.scenarioType) {
        case "technical": return (0, technical_prompt_1.buildTechnicalFeedbackPrompt)(state);
        case "background": return (0, background_prompt_1.buildBackgroundFeedbackPrompt)(state);
        case "culture": return (0, culture_prompt_1.buildCultureFeedbackPrompt)(state);
        default: return (0, background_prompt_1.buildBackgroundFeedbackPrompt)(state);
    }
};
exports.buildFeedbackPrompt = buildFeedbackPrompt;
//# sourceMappingURL=feedback.node.js.map