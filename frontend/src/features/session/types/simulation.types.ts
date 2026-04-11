export type SimulationStage =
  | "idle"
  | "initializing_ai"
  | "generating_persona"
  | "fetching_token"
  | "connecting_gemini"
  | "ready"
  | "user_speaking"
  | "waiting_for_ai"
  | "ai_speaking"
  | "ai_finished"
  | "ended"
  | "error";

export type LoadingStepKey = 
  | "initializing_ai" 
  | "generating_persona" 
  | "fetching_token" 
  | "connecting_gemini" 
  | "ready";

export interface LoadingStep {
  key: LoadingStepKey;
  label: string;
  description: string;
  progress: number;
  completed: boolean;
}

export const LOADING_STEPS: Record<LoadingStepKey, Omit<LoadingStep, "completed" | "key">> = {
  initializing_ai: {
    label: "Initializing AI Session",
    description: "Preparing the interview environment...",
    progress: 20
  },
  generating_persona: {
    label: "Generating Dynamic pPersona",
    description: "Building the interviewer persona...",
    progress: 40
  },
  fetching_token: {
    label: "Securing Connection",
    description: "Fetching authentication token...",
    progress: 60
  },
  connecting_gemini: {
    label: "Connecting",
    description: "Establishing realtime websocket...",
    progress: 80
  },
  ready: {
    label: "Ready",
    description: "Interview is ready to begin.",
    progress: 100
  }
};



