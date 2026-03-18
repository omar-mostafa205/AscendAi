import { Job, Persona } from "@prisma/client";
type ScenarioType = "technical" | "background" | "culture";
declare function getOrCreatePersona(job: Job, scenarioType: ScenarioType): Promise<Persona>;
export declare const personaService: {
    getOrCreatePersona: typeof getOrCreatePersona;
};
export {};
