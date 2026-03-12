"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInterviewGraph = void 0;
const langgraph_1 = require("@langchain/langgraph");
const langgraph_checkpoint_postgres_1 = require("@langchain/langgraph-checkpoint-postgres");
const interview_state_1 = require("./interview-state");
const question_node_1 = require("../nodes/question.node");
const feedback_node_1 = require("../nodes/feedback.node");
const env_1 = require("../../../config/env");
let compiledGraphPromise = null;
const createInterviewGraph = async () => {
    // Compiling the graph sets up the Postgres checkpointer and can be expensive.
    // Cache it so live interview turns are fast.
    if (compiledGraphPromise)
        return compiledGraphPromise;
    compiledGraphPromise = (async () => {
        const checkpointer = langgraph_checkpoint_postgres_1.PostgresSaver.fromConnString(env_1.env.DATABASE_URL);
        await checkpointer.setup();
        const graph = new langgraph_1.StateGraph(interview_state_1.InterviewState);
        graph
            .addNode("question", question_node_1.questionNode)
            .addNode("feedback_node", feedback_node_1.feedbackNode)
            .addEdge("__start__", "question")
            .addEdge("question", "feedback_node")
            .addEdge("feedback_node", langgraph_1.END);
        return graph.compile({ checkpointer });
    })();
    return compiledGraphPromise;
};
exports.createInterviewGraph = createInterviewGraph;
exports.default = exports.createInterviewGraph;
//# sourceMappingURL=interview-graph.js.map