"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFeedbackPrompt = void 0;
const scoringFields = {
    technical: `
  "communicationScore": <number 0-100>,
  "technicalScore": <number 0-100>,
  "problemSolvingScore": <number 0-100>,`,
    background: `
  "communicationScore": <number 0-100>,
  "problemSolvingScore": <number 0-100>,`,
    culture: `
  "communicationScore": <number 0-100>,`,
};
const buildFeedbackPrompt = (conversation, scenarioType) => {
    return `
You are an expert interview coach evaluating a ${scenarioType} job interview.

Here is the full interview transcript:
<transcript>
${conversation}
</transcript>

Evaluate the candidate's performance based on the transcript above.

Respond ONLY with a valid JSON object.
No preamble, no explanation, no markdown fences — just the raw JSON.

{
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "weaknesses": ["<specific weakness 1>", "<specific weakness 2>"],
  "recommendations": ["<actionable recommendation 1>", "<actionable recommendation 2>", "<actionable recommendation 3>"],${scoringFields[scenarioType]}
  "overallScore": <number 0-100>,
  "summary": "<2-3 sentence overall assessment of the candidate>"
}
`.trim();
};
exports.buildFeedbackPrompt = buildFeedbackPrompt;
//# sourceMappingURL=feedback.prompt.js.map