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
        messages: import("@prisma/client/runtime/client").JsonValue | null;
    };
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
declare function getSession(sessionId: string, userId: string): Promise<{
    id: string;
    job: {
        title: string;
        company: string;
    } | null;
    jobId: string | null;
    scenarioType: string;
    status: string;
    startedAt: Date;
    endedAt: Date | null;
}>;
declare function endSession(sessionId: string, userId: string): Promise<{
    id: string;
    status: string;
}>;
declare function getLiveToken(sessionId: string, userId: string, scenarioType?: ScenarioType): Promise<{
    token: string;
    sessionId: string;
    model: string;
}>;
export declare const sessionService: {
    readonly createSession: typeof createSession;
    readonly getSessions: typeof getSessions;
    readonly getSession: typeof getSession;
    readonly endSession: typeof endSession;
    readonly getLiveToken: typeof getLiveToken;
};
export {};
