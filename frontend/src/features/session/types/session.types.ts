export type ScenarioType = "technical" | "background" | "culture";

export interface InterviewSession {
  id: string;
  scenarioType: ScenarioType;
  jobTitle: string;
  company: string;
  startedAt: string;
  jobId: string;
}

export const SCENARIO_CONFIG: Record<ScenarioType, { label: string; image: string }> = {
  technical: { label: "Technical", image: "purple-avatar.png" },
  background: { label: "Background", image: "blue-avatar.png" },
  culture: { label: "Culture", image: "orange-avatar.png" },
};

export const MAX_SESSION_DURATION_MS = 7 * 60 * 1000;
