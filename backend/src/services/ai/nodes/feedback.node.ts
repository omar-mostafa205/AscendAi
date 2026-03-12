import { model } from "../../../config/gemeni"
import { InterviewStateType } from "../graphs/interview-state"
import { buildBackgroundFeedbackPrompt } from "../prompts/background.prompt"
import { buildCultureFeedbackPrompt } from "../prompts/culture.prompt"
import { buildTechnicalFeedbackPrompt } from "../prompts/technical.prompt"
import { AIMessage } from "@langchain/core/messages"
import { geminiGenerateContentWithRetry } from "../gemini-retry"

export const feedbackNode = async (state : InterviewStateType) => {
    if (!state.isComplete) {
      return {}
    }

    const fallbackJson = JSON.stringify(
      {
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
        summary:
          "Solid baseline performance with clear communication. Improve by adding concrete examples and tightening answers.",
      },
      null,
      2
    )

    const text = await geminiGenerateContentWithRetry(
      () => model.generateContent(buildFeedbackPrompt(state)),
      { fallbackText: fallbackJson }
    )

    let parsed: any = null
    try {
      parsed = JSON.parse(String(text).replace(/```json|```/g, "").trim())
    } catch {
      parsed = null
    }

    const feedback = parsed && typeof parsed === "object" ? parsed : null
    const overallScore =
      feedback && typeof feedback.overallScore === "number" ? feedback.overallScore : null
  
    return {
      messages: [new AIMessage(text)],
      feedback,
      overallScore,
    }
}  

export const buildFeedbackPrompt = (state: InterviewStateType): string => {
    switch (state.scenarioType) {
      case "technical":   return buildTechnicalFeedbackPrompt(state)
      case "background":  return buildBackgroundFeedbackPrompt(state)
      case "culture":     return buildCultureFeedbackPrompt(state)
      default:            return buildBackgroundFeedbackPrompt(state)
    }
  }
