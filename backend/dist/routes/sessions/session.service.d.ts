type ScenarioType = "technical" | "background" | "culture";
declare function createSession(userId: string, jobId: string, scenarioType: ScenarioType): Promise<{
    session: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        jobId: string | null;
        personaId: string | null;
        voiceId: string | null;
        scenarioType: string;
        difficultyLevel: string;
        status: string;
        livekitRoomName: string | null;
        startedAt: Date;
        endedAt: Date | null;
        durationSeconds: number | null;
        overallScore: number | null;
        feedback: import("@prisma/client/runtime/client").JsonValue | null;
    };
    livekitToken: any;
}>;
declare function getSessions(jobId: string, userId: string): Promise<{
    score: number | null;
    id: string;
    createdAt: Date;
    scenarioType: string;
    status: string;
    overallScore: number | null;
    feedback: import("@prisma/client/runtime/client").JsonValue;
}[]>;
export declare const sessionService: {
    readonly createSession: typeof createSession;
    readonly getSessions: typeof getSessions;
};
export {};
