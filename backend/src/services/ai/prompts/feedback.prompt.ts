// services/ai/prompts/feedback.prompt.ts
type ScenarioType = "technical" | "background" | "culture";

const scoringFields: Record<ScenarioType, string> = {
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

export const buildFeedbackPrompt = (
  conversation: string,
  scenarioType: ScenarioType,
): string => {
  return `
You are an expert interview coach evaluating a ${scenarioType} job interview.

Here is the full interview transcript:
<transcript>
${conversation}
</transcript>

CRITICAL INSTRUCTION — TRANSCRIPT QUALITY:
This transcript was captured via real-time speech-to-text and contains STT artifacts.
You MUST apply the following rules before evaluating anything:

1. RECONSTRUCT broken words — e.g. "doc ument acher gene tor" = "document generator",
   "par sing" = "parsing", "cu menta tion" = "documentation", "mul tiple ngua ges" = "multiple languages".
2. IGNORE split syllables, missing letters, and mid-word spaces entirely.
3. ASSUME the most intelligent, coherent interpretation of every candidate utterance.
4. NEVER penalize for transcription noise, broken words, or STT errors.
5. If a sentence is partially cut off, infer its likely meaning from context and evaluate that.

Only after reconstructing the intended meaning, evaluate the candidate on:
- The quality and depth of their ideas
- Their problem-solving approach
- Relevance and structure of their answers

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
