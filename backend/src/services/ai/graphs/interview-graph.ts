import { StateGraph, END } from "@langchain/langgraph"
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres"
import { InterviewState } from "./interview-state"
import { questionNode } from "../nodes/question.node"
import {feedbackNode} from "../nodes/feedback.node"
import { env } from "../../../config/env"

let compiledGraphPromise: Promise<ReturnType<StateGraph<typeof InterviewState>["compile"]>> | null =
  null

export const createInterviewGraph = async () => {
  // Compiling the graph sets up the Postgres checkpointer and can be expensive.
  // Cache it so live interview turns are fast.
  if (compiledGraphPromise) return compiledGraphPromise

  compiledGraphPromise = (async () => {
    const checkpointer = PostgresSaver.fromConnString(env.DATABASE_URL)
    await checkpointer.setup()

    const graph = new StateGraph(InterviewState)

    graph
      .addNode("question", questionNode)
      .addNode("feedback_node", feedbackNode)
      .addEdge("__start__", "question")
      .addEdge("question", "feedback_node")
      .addEdge("feedback_node", END)

    return graph.compile({ checkpointer })
  })()

  return compiledGraphPromise
}
  
  export default createInterviewGraph
