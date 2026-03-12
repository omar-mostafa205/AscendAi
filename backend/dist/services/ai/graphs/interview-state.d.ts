import { BaseMessage } from "@langchain/core/messages";
export interface FeedbackResult {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    communicationScore: number;
    technicalScore?: number;
    problemSolvingScore?: number;
    overallScore: number;
    summary: string;
}
export declare const InterviewState: import("@langchain/langgraph").AnnotationRoot<{
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage<import("@langchain/core/messages").MessageStructure<import("@langchain/core/messages").MessageToolSet>, import("@langchain/core/messages").MessageType>[], BaseMessage<import("@langchain/core/messages").MessageStructure<import("@langchain/core/messages").MessageToolSet>, import("@langchain/core/messages").MessageType>[]>;
    currentQuestion: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    questionCount: import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
    maxQuestions: import("@langchain/langgraph").BinaryOperatorAggregate<number, number>;
    scores: import("@langchain/langgraph").BinaryOperatorAggregate<Record<string, number>, Record<string, number>>;
    jobContext: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    personaContext: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    isComplete: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    feedback: import("@langchain/langgraph").BinaryOperatorAggregate<FeedbackResult | null, FeedbackResult | null>;
    overallScore: import("@langchain/langgraph").BinaryOperatorAggregate<number | null, number | null>;
    scenarioType: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
}>;
export type InterviewStateType = typeof InterviewState.State;
