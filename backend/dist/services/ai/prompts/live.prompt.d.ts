import { Job, Persona } from "@prisma/client";
type ScenarioType = "technical" | "background" | "culture";
export declare const buildLiveInterviewPrompt: (job: Job, persona: Persona, scenarioType: ScenarioType) => string;
export {};
