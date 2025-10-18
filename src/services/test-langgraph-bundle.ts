// TEST FILE: Import LangGraph to see actual bundle impact
import { StateGraph, END } from "@langchain/langgraph";
import { ChatGeminiNano } from "./gemini-nano-langchain";

// Simple test to prove LangGraph can work
export async function testLangGraphBundle() {
  console.log("Testing LangGraph bundle size impact...");
  
  // This code won't run, but importing it will show us the bundle size
  const model = new ChatGeminiNano({ temperature: 0.3, topK: 1 });
  
  interface AgentState {
    noteContent: string;
    nextAction: string | null;
  }
  
  const workflow = new StateGraph<AgentState>({
    channels: {
      noteContent: { value: null },
      nextAction: { value: null },
    }
  });
  
  return { model, workflow };
}
