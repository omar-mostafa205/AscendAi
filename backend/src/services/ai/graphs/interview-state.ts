import { Annotation } from "@langchain/langgraph"
import { BaseMessage } from "@langchain/core/messages"

export interface FeedbackResult {
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  communicationScore: number
  technicalScore?: number
  problemSolvingScore?: number
  overallScore: number
  summary: string
}
export const InterviewState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  currentQuestion: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),
  questionCount: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),
  maxQuestions: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 8,
  }),
  scores: Annotation<Record<string, number>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({}),
  }),
  jobContext: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),
  personaContext: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),
  isComplete: Annotation<boolean>({
    reducer: (_, update) => update,
    default: () => false,
  }),
  feedback : Annotation<FeedbackResult | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  overallScore: Annotation<number | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  scenarioType: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),
})

export type InterviewStateType = typeof InterviewState.State
