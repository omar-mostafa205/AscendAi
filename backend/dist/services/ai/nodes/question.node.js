"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.questionNode = void 0;
const gemeni_1 = require("../../../config/gemeni");
const messages_1 = require("@langchain/core/messages");
const gemini_retry_1 = require("../gemini-retry");
const questionNode = async (state) => {
    const conversationHistory = state.messages
        .map((m) => m instanceof messages_1.HumanMessage
        ? `Candidate: ${m.content}`
        : `Interviewer: ${m.content}`)
        .join("\n");
    const lastHuman = [...(state.messages ?? [])]
        .reverse()
        .find((m) => m instanceof messages_1.HumanMessage);
    const lastAnswer = typeof lastHuman?.content === "string" ? lastHuman.content.trim() : "";
    const isClarificationRequest = lastAnswer &&
        /what do you mean|can you (explain|clarify|rephrase|elaborate)|i (don't|dont) understand|could you repeat|what is the question|please clarify/i.test(lastAnswer);
    const isVague = lastAnswer.length > 0 &&
        lastAnswer.split(/\s+/).length < 8 &&
        !isClarificationRequest;
    const buildQuestionPrompt = () => `
You are ${state.personaContext}

You are conducting a ${state.scenarioType} interview for this role:
<job_description>
${state.jobContext}
</job_description>

This is turn ${state.questionCount + 1} of ${state.maxQuestions} maximum questions.

<conversation_history>
${conversationHistory || "No conversation yet. This is the opening of the interview."}
</conversation_history>

<rules>
RULE 1 — CLARIFICATION:
${isClarificationRequest
        ? `The candidate is asking for clarification. 
     Rephrase or explain your last question clearly in 1-2 sentences.
     Do NOT ask a new question. Do NOT move to a new topic.
     Just clarify what you already asked.`
        : ""}

RULE 2 — VAGUE ANSWER:
${isVague && state.questionCount > 0
        ? `The candidate's last answer was too short or vague.
     Ask a follow-up on the EXACT same topic.
     Do NOT move to a new topic yet.`
        : ""}

RULE 3 — NORMAL FLOW (applies when not clarifying and answer was complete):
- Acknowledge the answer in ONE brief sentence (e.g. "Got it." / "That makes sense.")
- Then ask the next relevant question based on the job description and conversation so far
- Choose a topic not yet covered in the conversation history
- Dig deeper into technical skills, past experience, or problem solving relevant to the role

RULE 4 — ALWAYS:
- Ask exactly ONE question per response
- Never ask a question already asked in the conversation history
- Keep your full response under 5 sentences
- Do not use bullet points or lists
- Stay in character as the interviewer with your personality traits
- Do not say "As an AI" or break character

${state.questionCount + 1 >= state.maxQuestions
        ? "RULE 5 — FINAL QUESTION: This is your last question. Make it count — ask something that reveals the candidate's depth."
        : ""}
</rules>

Respond now as the interviewer.
`;
    const fallbackQuestion = state.questionCount === 0
        ? "Tell me about yourself and what drew you to apply for this role."
        : isClarificationRequest
            ? "Let me rephrase — I was asking about your approach to solving that type of problem in practice. Could you walk me through a specific example?"
            : "Could you elaborate on your last answer with a concrete example from your experience?";
    const text = await (0, gemini_retry_1.geminiGenerateContentWithRetry)(() => gemeni_1.model.generateContent(buildQuestionPrompt()), { fallbackText: fallbackQuestion, timeoutMs: 8000, maxAttempts: 2 });
    return {
        messages: [new messages_1.AIMessage(text)],
        currentQuestion: text,
        questionCount: state.questionCount + 1,
    };
};
exports.questionNode = questionNode;
//# sourceMappingURL=question.node.js.map