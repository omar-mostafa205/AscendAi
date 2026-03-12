"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCultureFeedbackPrompt = void 0;
const buildCultureFeedbackPrompt = (state) => `
You are an expert culture fit interviewer evaluating a candidate's alignment with company values and team dynamics.

<job_description>
${state.jobContext}
</job_description>

<persona>
${state.personaContext}
</persona>

<conversation>
${state.messages
    .map((m) => m._getType() === "human"
    ? `Candidate: ${m.content}`
    : `Interviewer: ${m.content}`)
    .join("\n")}
</conversation>

Evaluate the candidate on:
- Alignment with company values and mission
- Collaboration and teamwork mindset
- Adaptability and openness to feedback
- Emotional intelligence and communication style
- Long-term motivation and career alignment with the role

Respond ONLY with valid JSON, no preamble, no markdown:
{
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "communicationScore": <0-100>,
  "overallScore": <0-100>,
  "summary": "2-3 sentence overall assessment"
}
`;
exports.buildCultureFeedbackPrompt = buildCultureFeedbackPrompt;
//# sourceMappingURL=culture.prompt.js.map