/**
 * LangGraph Agent System for MindKeep
 * 
 * This replaces the custom graph-engine implementation with LangGraph.js
 * for better reliability, maintenance, and community support.
 */

import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { ChatGeminiNano } from "./gemini-nano-langchain";
import { PersonaToolkit } from "./persona-toolkit";
import type { Note, Persona } from "./db-service";
import { getEnabledPersonas, addAgentExecutionLog } from "./db-service";

/**
 * Define AgentState using LangGraph's Annotation pattern
 * This is the recommended way to define state in LangGraph.js
 */
export const AgentState = Annotation.Root({
  // Input
  originalNote: Annotation<Note>({
    reducer: (_, y) => y, // Always use latest value
  }),
  currentNote: Annotation<Note>({
    reducer: (_, y) => y,
  }),
  embedding: Annotation<number[]>({
    reducer: (_, y) => y,
  }),
  encryptedContent: Annotation<string>({
    reducer: (_, y) => y,
  }),

  // Execution tracking
  executionHistory: Annotation<
    Array<{
      personaName: string;
      action: string;
      result: any;
      timestamp: Date;
    }>
  >({
    reducer: (x, y) => (x || []).concat(y || []), // Append new items
    default: () => [],
  }),
  iterationCount: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 0,
  }),
  maxIterations: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 10,
  }),

  // Routing
  nextPersona: Annotation<string | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  lastMatchedPersona: Annotation<string | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  personasExecuted: Annotation<Map<string, number>>({
    reducer: (x, y) => y || x, // Use new value if provided
    default: () => new Map(),
  }),

  // In-memory note tracking (for notes created during pipeline)
  createdNotes: Annotation<Note[]>({
    reducer: (x, y) => (x || []).concat(y || []),
    default: () => [],
  }),

  // Output flags
  shouldSaveNote: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => true,
  }),
  shouldDeleteNote: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),
  finalNote: Annotation<Note | undefined>({
    reducer: (_, y) => y,
    default: () => undefined,
  }),
});

// Export the state type for use in other files
export type AgentStateType = typeof AgentState.State;

/**
 * Supervisor Node - Routes notes to appropriate personas
 * Uses Gemini Nano to classify and decide next action
 */
export async function supervisorNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  console.log(`\n🧠 Supervisor - Iteration ${state.iterationCount + 1}`);

  // Check if we've hit max iterations
  if (state.iterationCount >= state.maxIterations) {
    console.log("⏹️  Max iterations reached");
    return { nextPersona: null };
  }

  // Get available personas
  const allPersonas = await getEnabledPersonas();

  if (allPersonas.length === 0) {
    console.log("⚠️  No personas available");
    return { nextPersona: null };
  }

  // Filter out personas that have exceeded their max iterations
  const availablePersonas = allPersonas.filter((p) => {
    const executionCount = state.personasExecuted.get(p.name) || 0;
    return executionCount < p.maxIterations;
  });

  if (availablePersonas.length === 0) {
    console.log("✅ All personas have completed their work");
    return { nextPersona: null };
  }

  // Build prompt for classification
  const personaList = availablePersonas
    .sort((a, b) => a.priority - b.priority)
    .map((p, idx) => {
      const executionCount = state.personasExecuted.get(p.name) || 0;
      return `${idx + 1}. "${p.name}" (priority: ${p.priority}, executions: ${executionCount}/${p.maxIterations})
   Trigger: ${p.triggerPrompt}`;
    })
    .join("\n");

  const prompt = `You are an intelligent routing agent for a note-taking system.

Your job is to analyze the note content and decide which persona (if any) should handle it next.

AVAILABLE PERSONAS:
${personaList}

NOTE CONTENT:
Title: ${state.currentNote.title}
Category: ${state.currentNote.category}
Content: ${state.currentNote.content}

INSTRUCTIONS:
1. Read the note content carefully
2. Check each persona's trigger condition
3. If a persona matches, output EXACTLY its name (e.g., "Password Librarian")
4. If NO persona matches, output EXACTLY the word "none"
5. Only output the persona name or "none" - nothing else

Your response (persona name or "none"):`;

  try {
    const model = new ChatGeminiNano({ temperature: 0.3, topK: 1 });
    const responseMessage = await model.invoke(prompt);
    
    // Extract text content from the message
    const responseText = typeof responseMessage.content === 'string' 
      ? responseMessage.content 
      : JSON.stringify(responseMessage.content);
    
    const decision = responseText.trim();
    console.log(`📋 Supervisor decision: "${decision}"`);

    // Validate decision
    if (decision.toLowerCase() === "none") {
      console.log("✅ No persona matched - ending pipeline");
      return { nextPersona: null };
    }

    // Find matching persona (case-insensitive)
    const matchedPersona = availablePersonas.find(
      (p) => p.name.toLowerCase() === decision.toLowerCase()
    );

    if (!matchedPersona) {
      console.log(`⚠️  Unknown persona "${decision}" - ending pipeline`);
      return { nextPersona: null };
    }

    console.log(`✅ Routing to: ${matchedPersona.name}`);
    return {
      nextPersona: matchedPersona.name,
      lastMatchedPersona: matchedPersona.name,
      iterationCount: state.iterationCount + 1,
    };
  } catch (error) {
    console.error("❌ Supervisor error:", error);
    return { nextPersona: null };
  }
}

/**
 * Persona Executor Node - Executes persona actions
 * This is a dynamic node that gets the persona from state
 */
export async function personaExecutorNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const personaName = state.nextPersona;

  if (!personaName) {
    console.log("⚠️  No persona specified in executor");
    return {};
  }

  console.log(`\n🤖 Executing Persona: ${personaName}`);

  // Get the persona details
  const allPersonas = await getEnabledPersonas();
  const persona = allPersonas.find((p) => p.name === personaName);

  if (!persona) {
    console.error(`❌ Persona "${personaName}" not found`);
    return {};
  }

  // Update execution count
  const newPersonasExecuted = new Map(state.personasExecuted);
  const currentCount = (newPersonasExecuted.get(personaName) as number) || 0;
  newPersonasExecuted.set(personaName, currentCount + 1);

  // Build context from previous actions
  const previousActions = state.executionHistory
    .filter((h) => h.personaName === personaName)
    .slice(-3); // Last 3 actions for this persona

  const contextSection =
    previousActions.length > 0
      ? `\n=== PREVIOUS ACTIONS BY YOU ===\n${previousActions
          .map(
            (action, idx) =>
              `${idx + 1}. ${action.action}\n   Result: ${action.result.success ? "✅ SUCCESS" : "❌ FAILED"}`
          )
          .join("\n")}\n=============================\n`
      : "";

  // Build the execution prompt
  const prompt = `${persona.actionPrompt}

${contextSection}

CURRENT NOTE:
Title: ${state.currentNote.title}
Category: ${state.currentNote.category}
Content: ${state.currentNote.content}

AVAILABLE TOOLS:
${persona.toolsAllowed.join(", ")}

CRITICAL RULES:
1. Plan ONLY ONE action
2. Use ONLY tools from the available list
3. Output valid JSON with this structure:
{
  "reasoning": "Why this action is needed",
  "actions": [
    {
      "tool": "tool.name",
      "parameters": { ... }
    }
  ]
}

Your response (JSON only):`;

  try {
    const model = new ChatGeminiNano({ temperature: 0.5, topK: 8 });
    const responseMessage = await model.invoke(prompt);
    
    // Extract text content from the message
    const responseText = typeof responseMessage.content === 'string' 
      ? responseMessage.content 
      : JSON.stringify(responseMessage.content);

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.actions || !Array.isArray(parsed.actions)) {
      throw new Error("Invalid action structure");
    }

    console.log(`💭 Reasoning: ${parsed.reasoning}`);

    // Execute actions using toolkit
    const toolkit = new PersonaToolkit(
      persona.toolsAllowed,
      state.currentNote.id,
      state.createdNotes
    );

    const newExecutionHistory = [...state.executionHistory];
    let updatedNote = state.currentNote;
    let shouldSave = state.shouldSaveNote;
    let shouldDelete = state.shouldDeleteNote;

    for (const action of parsed.actions) {
      console.log(`🔧 Tool: ${action.tool}`);

      const result = await toolkit.execute(
        action.tool,
        action.parameters,
        updatedNote
      );

      newExecutionHistory.push({
        personaName,
        action: action.tool,
        result,
        timestamp: new Date(),
      });

      console.log(
        `   ${result.success ? "✅" : "❌"} ${result.success ? result.data : result.error}`
      );

      // Update note if tool modified it
      if (result.success && result.data?.note) {
        updatedNote = result.data.note;
      }

      // Handle special flags
      if (result.success && result.data?.deleted) {
        shouldDelete = true;
        shouldSave = false;
      }
    }

    // Log execution
    if (state.maxIterations > 0) {
      await addAgentExecutionLog({
        noteId: state.originalNote.id,
        personaName,
        actionsExecuted: parsed.actions.length,
        success: true,
        result: "Completed successfully",
      });
    }

    return {
      currentNote: updatedNote,
      executionHistory: newExecutionHistory,
      personasExecuted: newPersonasExecuted,
      shouldSaveNote: shouldSave,
      shouldDeleteNote: shouldDelete,
      finalNote: updatedNote,
    };
  } catch (error) {
    console.error(`❌ Execution error:`, error);

    // Log failure
    await addAgentExecutionLog({
      noteId: state.originalNote.id,
      personaName,
      actionsExecuted: 0,
      success: false,
      result: error.message,
    });

    return {
      personasExecuted: newPersonasExecuted,
    };
  }
}

/**
 * Router function - Determines next step in the graph
 */
export function routeAfterSupervisor(state: AgentStateType): string {
  if (!state.nextPersona) {
    return END;
  }
  return "executor";
}

/**
 * Create and compile the LangGraph workflow
 */
export function createAgentWorkflow() {
  // Define the graph using Annotation-based state
  const workflow = new StateGraph(AgentState);

  // Add nodes
  workflow.addNode("supervisor", supervisorNode);
  workflow.addNode("executor", personaExecutorNode);

  // Set entry point - start with supervisor
  workflow.addEdge(START, "supervisor");

  // Add conditional edges from supervisor
  workflow.addConditionalEdges("supervisor", routeAfterSupervisor, {
    executor: "executor",
    [END]: END,
  });

  // After executor, always go back to supervisor
  workflow.addEdge("executor", "supervisor");

  // Compile and return
  return workflow.compile();
}
