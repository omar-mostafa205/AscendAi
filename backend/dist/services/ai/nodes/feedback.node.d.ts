import { InterviewStateType } from "../graphs/interview-state";
import { AIMessage } from "@langchain/core/messages";
export declare const feedbackNode: (state: InterviewStateType) => Promise<{
    messages?: undefined;
    feedback?: undefined;
    overallScore?: undefined;
} | {
    messages: AIMessage<import("@langchain/core/messages").MessageStructure<import("@langchain/core/messages").MessageToolSet>>[];
    feedback: any;
    overallScore: any;
}>;
export declare const buildFeedbackPrompt: (state: InterviewStateType) => string;
