import { InterviewStateType } from "../graphs/interview-state";

export const buildTechnicalFeedbackPrompt = (state: InterviewStateType): string => `
You are an expert technical interviewer evaluating a candidate's performance.

<job_description>
${state.jobContext}
</job_description>

<persona>
${state.personaContext}
</persona>

<conversation>
${state.messages
  .map((m) =>
    m._getType() === "human"
      ? `Candidate: ${m.content}`
      : `Interviewer: ${m.content}`
  )
  .join("\n")}
</conversation>

Evaluate the candidate on technical knowledge, problem-solving approach, system design thinking, and code quality awareness.

Respond ONLY with valid JSON, no preamble, no markdown:
{
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "communicationScore": <0-100>,
  "technicalScore": <0-100>,
  "problemSolvingScore": <0-100>,
  "overallScore": <0-100>,
  "summary": "2-3 sentence overall assessment"
}
`