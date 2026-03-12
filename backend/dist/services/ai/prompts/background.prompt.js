"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBackgroundFeedbackPrompt = void 0;
const buildBackgroundFeedbackPrompt = (state) => `
You are an expert interviewer evaluating how well a candidate's background and experience aligns with the role.

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
- Relevance of past experience to the role
- Depth and quality of previous projects
- Career trajectory and growth
- Ability to articulate their background clearly
- How well their skills match the job requirements

Respond ONLY with valid JSON, no preamble, no markdown:
{
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "communicationScore": <0-100>,
  "problemSolvingScore": <0-100>,
  "overallScore": <0-100>,
  "summary": "2-3 sentence overall assessment"
}
`;
exports.buildBackgroundFeedbackPrompt = buildBackgroundFeedbackPrompt;
//# sourceMappingURL=background.prompt.js.map