import { Job } from "@prisma/client";
type ScenarioType = "technical" | "background" | "culture";
export declare const buildPersonaCreationPrompt: (job: Job, scenarioType: ScenarioType) => string;
export {};
