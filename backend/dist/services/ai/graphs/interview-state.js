"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterviewState = void 0;
const langgraph_1 = require("@langchain/langgraph");
exports.InterviewState = langgraph_1.Annotation.Root({
    messages: (0, langgraph_1.Annotation)({
        reducer: (current, update) => [...current, ...update],
        default: () => [],
    }),
    currentQuestion: (0, langgraph_1.Annotation)({
        reducer: (_, update) => update,
        default: () => "",
    }),
    questionCount: (0, langgraph_1.Annotation)({
        reducer: (_, update) => update,
        default: () => 0,
    }),
    maxQuestions: (0, langgraph_1.Annotation)({
        reducer: (_, update) => update,
        default: () => 8,
    }),
    scores: (0, langgraph_1.Annotation)({
        reducer: (current, update) => ({ ...current, ...update }),
        default: () => ({}),
    }),
    jobContext: (0, langgraph_1.Annotation)({
        reducer: (_, update) => update,
        default: () => "",
    }),
    personaContext: (0, langgraph_1.Annotation)({
        reducer: (_, update) => update,
        default: () => "",
    }),
    isComplete: (0, langgraph_1.Annotation)({
        reducer: (_, update) => update,
        default: () => false,
    }),
    feedback: (0, langgraph_1.Annotation)({
        reducer: (_, update) => update,
        default: () => null,
    }),
    overallScore: (0, langgraph_1.Annotation)({
        reducer: (_, update) => update,
        default: () => null,
    }),
    scenarioType: (0, langgraph_1.Annotation)({
        reducer: (_, update) => update,
        default: () => "",
    }),
});
//# sourceMappingURL=interview-state.js.map