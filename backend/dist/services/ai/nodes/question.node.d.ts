import { AIMessage } from "@langchain/core/messages";
import { InterviewState } from "../graphs/interview-state";
export declare const questionNode: (state: typeof InterviewState.State) => Promise<{
    messages: AIMessage<import("@langchain/core/messages").MessageStructure<import("@langchain/core/messages").MessageToolSet>>[];
    currentQuestion: string;
    questionCount: number;
}>;
