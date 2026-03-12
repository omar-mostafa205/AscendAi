import { model } from "../../../config/gemeni"
import { AIMessage, HumanMessage } from "@langchain/core/messages"
import { InterviewState } from "../graphs/interview-state"
import { geminiGenerateContentWithRetry } from "../gemini-retry"

export const questionNode = async (state: typeof InterviewState.State) => {
  const extractTopics = (jobContext: string): string[] => {
    const t: string[] = []
    const s = (jobContext || "").toLowerCase()

    const add = (label: string, patterns: RegExp[]) => {
      if (t.includes(label)) return
      if (patterns.some((p) => p.test(s))) t.push(label)
    }

    add("Next.js", [/next\.js/, /\bnextjs\b/])
    add("React", [/\breact\b/])
    add("Node.js", [/\bnode\.js\b/, /\bnodejs\b/, /\bnode\b/])
    add("Postgres", [/\bpostgres\b/, /\bpostgresql\b/])
    add("Prisma", [/\bprisma\b/])
    add("Authentication", [/\bauth\b/, /\boauth\b/, /\bjwt\b/, /\bsso\b/])
    add("System Design", [/\bsystem design\b/, /\barchitecture\b/, /\bscalab/i])
    add("Testing", [/\btest\b/, /\bjest\b/, /\bplaywright\b/, /\bcypress\b/])
    add("Performance", [/\bperformance\b/, /\blatency\b/, /\boptimi/i])
    add("DevOps", [/\bdocker\b/, /\bkubernetes\b/, /\bci\/cd\b/, /\bterraform\b/])

    return t.length ? t : ["Backend APIs", "Databases", "Frontend Architecture"]
  }

  const lastHuman = [...(state.messages ?? [])].reverse().find((m) => m instanceof HumanMessage) as
    | HumanMessage
    | undefined
  const lastAnswer = typeof lastHuman?.content === "string" ? lastHuman.content.trim() : ""
  const lastAnswerWords = lastAnswer ? lastAnswer.split(/\s+/).filter(Boolean).length : 0

  const isVagueOrEmpty =
    !lastAnswer ||
    (lastAnswer.length < 40 && lastAnswerWords < 7) ||
    /^\(audio received;.*\)$/i.test(lastAnswer) ||
    /transcription/i.test(lastAnswer)

  const buildFallbackQuestion = (): string => {
    if (isVagueOrEmpty && (state.questionCount ?? 0) > 0) {
      return "I didn't catch enough detail there. Can you restate your answer with a concrete example and what you specifically did?"
    }

    const topics = extractTopics(state.jobContext || "")
    const topic = topics[(state.questionCount ?? 0) % topics.length]
    const scenario = (state.scenarioType || "technical").toString()

    const templatesByScenario: Record<string, string[]> = {
      technical: [
        `Let's go deeper on ${topic}. Can you describe a real system you built using it, and walk me through the architecture and key tradeoffs?`,
        `In ${topic}, what are the top 2 or 3 failure modes you've seen in production, and how do you detect and fix them?`,
        `Pick one challenging bug or incident related to ${topic}. How did you investigate it and what was the root cause?`,
      ],
      background: [
        `Tell me about a recent project most relevant to this role. What was your responsibility and what did you ship?`,
        `What's a technical decision you're proud of recently, and what alternatives did you consider?`,
        `Describe a time you had to learn something new quickly for a project. What was it and how did you approach it?`,
      ],
      culture: [
        `Tell me about a time you disagreed with a teammate on a technical approach. How did you handle it?`,
        `How do you keep stakeholders aligned when requirements change mid-project? Give a concrete example.`,
        `What does "high quality" mean to you in a codebase, and how do you drive that in a team?`,
      ],
    }

    const list = templatesByScenario[scenario] ?? templatesByScenario.technical
    return list[(state.questionCount ?? 0) % list.length]
  }

  const buildQuestionPrompt = (): string => `
You are ${state.personaContext}

You are conducting a professional job interview.
This is question ${state.questionCount + 1} of ${state.maxQuestions}.

Rules:
- Ask ONE question at a time
- If the candidate's last answer was vague, too short, or unclear — ask a follow-up on the SAME topic before moving on
- If the answer was complete and satisfactory — move to the next topic
- Adapt difficulty based on previous answers
- Never break character

<job_description>
${state.jobContext}
</job_description>

<conversation_history>
${state.messages
  .map((m) =>
    m instanceof HumanMessage
      ? `Candidate: ${m.content}`
      : `Interviewer: ${m.content}`
  )
  .join("\n")}
</conversation_history>

Ask your next question now.
`
  const fallbackQuestion = buildFallbackQuestion()

  const text = await geminiGenerateContentWithRetry(
    () => model.generateContent(buildQuestionPrompt()),
    // Keep the conversation snappy: if Gemini is slow or rate-limited, use a dynamic fallback.
    { fallbackText: fallbackQuestion, timeoutMs: 2500, maxAttempts: 1 }
  )

  return {
    messages: [new AIMessage(text)],
    currentQuestion: text,
    questionCount: state.questionCount + 1,
  }
}
