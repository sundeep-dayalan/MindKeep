/**
 * Graph Engine
 * Multi-pass agentic execution engine for persona workflows
 * Supports iterative loops, dynamic re-routing, and state management
 */

import type { Note, Persona } from "./db-service"
import {
  addAgentExecutionLog,
  getEnabledPersonas,
  getPersonaByName
} from "./db-service"
import { PersonaExecutor, type Action } from "./persona-executor"
import { PersonaToolkit } from "./persona-toolkit"
import { classifyNote } from "./supervisor-service"

export interface GraphState {
  // Core data
  originalNote: Note // Never modified
  currentNote: Note // Can be modified by personas
  embedding: number[]
  encryptedContent: string

  // Execution tracking
  executionHistory: ExecutionStep[]
  iterationCount: number
  maxIterations: number

  // Routing state
  lastMatchedPersona: string | null
  personasExecuted: Map<string, number> // personaId -> execution count

  // Notes created during pipeline (not yet in database)
  createdNotes: Note[] // Track notes created during this pipeline

  // Final decision
  shouldSaveNote: boolean
  shouldDeleteNote: boolean
  finalNote?: Note
  handledByPersona?: string // Name of first persona that handled it
}

interface ExecutionStep {
  step: number
  nodeType: "supervisor" | "persona" | "end"
  personaName?: string
  timestamp: number
  actionsPerformed?: Action[]
}

export class GraphEngine {
  private maxGlobalIterations: number = 10

  /**
   * Run the multi-pass agent pipeline
   */
  async run(initialState: GraphState): Promise<GraphState> {
    let state = initialState
    let firstPersona: string | null = null

    console.log("🚀 Starting agent pipeline...")

    while (state.iterationCount < this.maxGlobalIterations) {
      console.log(`\n📍 Iteration ${state.iterationCount + 1}`)

      // 1. Run supervisor to classify current note state
      state = await this.executeSupervisor(state)

      // 2. Check if supervisor returned "none" (pipeline complete)
      if (state.lastMatchedPersona === null) {
        console.log("✅ Supervisor returned 'none' - pipeline complete")
        return this.finalizeExecution(state, firstPersona)
      }

      // Track first persona for the note
      if (!firstPersona) {
        firstPersona = state.lastMatchedPersona
      }

      // 3. Execute matched persona
      state = await this.executePersona(state)

      // 4. Increment iteration
      state.iterationCount++

      // 5. Safety check for infinite loops
      if (this.detectInfiniteLoop(state)) {
        console.warn("⚠️  Infinite loop detected, terminating pipeline")
        return this.finalizeExecution(state, firstPersona)
      }
    }

    console.log("⚠️  Max iterations reached, terminating pipeline")
    return this.finalizeExecution(state, firstPersona)
  }

  /**
   * Execute supervisor to classify note and route to persona
   */
  private async executeSupervisor(state: GraphState): Promise<GraphState> {
    console.log("🧠 Running supervisor classification...")

    // Get available personas (enabled, not exceeded max iterations)
    const availablePersonas = await this.getAvailablePersonas(state)

    console.log(`   ${availablePersonas.length} personas available`)

    // Classify note
    const matchedPersonaName = await classifyNote(
      state.currentNote.contentPlaintext,
      availablePersonas
    )

    return {
      ...state,
      lastMatchedPersona: matchedPersonaName,
      executionHistory: [
        ...state.executionHistory,
        {
          step: state.iterationCount,
          nodeType: "supervisor",
          timestamp: Date.now()
        }
      ]
    }
  }

  /**
   * Execute a persona's workflow
   */
  private async executePersona(state: GraphState): Promise<GraphState> {
    const personaName = state.lastMatchedPersona
    if (!personaName) {
      return state
    }

    console.log(`🤖 Executing persona: ${personaName}`)

    // Get persona definition
    const persona = await getPersonaByName(personaName)
    if (!persona) {
      console.error(`❌ Persona not found: ${personaName}`)
      return state
    }

    // Create toolkit with allowed tools
    const toolkit = new PersonaToolkit(
      persona.toolsAllowed,
      state.currentNote.id,
      state.createdNotes // Pass created notes for find operations
    )

    // Collect previous actions from this persona in current pipeline
    const previousActions: Action[] = state.executionHistory
      .filter(step => step.nodeType === "persona" && step.personaName === personaName)
      .flatMap(step => step.actionsPerformed || [])

    // Create executor
    const executor = new PersonaExecutor(persona, toolkit)

    // Execute persona with context from previous runs
    const result = await executor.execute(state.currentNote, previousActions)

    // Log execution
    if (result.success) {
      await addAgentExecutionLog({
        noteId: state.currentNote.id,
        personaId: persona.id,
        personaName: persona.name,
        executedAt: Date.now(),
        actionsPerformed: JSON.stringify(result.actionsPerformed),
        success: true
      })
    } else {
      await addAgentExecutionLog({
        noteId: state.currentNote.id,
        personaId: persona.id,
        personaName: persona.name,
        executedAt: Date.now(),
        actionsPerformed: JSON.stringify(result.actionsPerformed),
        success: false,
        error: result.error
      })
    }

    // Update persona execution count
    const executionCount = state.personasExecuted.get(persona.id) || 0
    state.personasExecuted.set(persona.id, executionCount + 1)

    // Update state with results
    let updatedNote = state.currentNote

    if (result.modifiedNote) {
      updatedNote = result.modifiedNote
      console.log(`   ✏️  Note was modified`)
    }

    if (result.deletedNoteIds && result.deletedNoteIds.length > 0) {
      console.log(`   🗑️  Deleted ${result.deletedNoteIds.length} notes`)
      // If current note was deleted, mark for deletion
      if (result.deletedNoteIds.includes(state.currentNote.id)) {
        state.shouldDeleteNote = true
      }
    }

    if (result.createdNotes && result.createdNotes.length > 0) {
      console.log(`   ➕ Created ${result.createdNotes.length} notes`)
    }

    return {
      ...state,
      currentNote: updatedNote,
      executionHistory: [
        ...state.executionHistory,
        {
          step: state.iterationCount,
          nodeType: "persona",
          personaName: persona.name,
          timestamp: Date.now(),
          actionsPerformed: result.actionsPerformed
        }
      ]
    }
  }

  /**
   * Get personas available for execution
   * Filters by: enabled status, max iterations not exceeded
   */
  private async getAvailablePersonas(
    state: GraphState
  ): Promise<Persona[]> {
    const allPersonas = await getEnabledPersonas()
    
    console.log(`   🔍 Debug: getEnabledPersonas() returned ${allPersonas.length} personas`)
    if (allPersonas.length > 0) {
      console.log(`   📋 Personas: ${allPersonas.map(p => `${p.name} (enabled=${p.enabled})`).join(', ')}`)
    }

    return allPersonas.filter((p) => {
      // Check if persona has reached max iterations
      const executionCount = state.personasExecuted.get(p.id) || 0
      return executionCount < p.maxIterations
    })
  }

  /**
   * Detect infinite loop by checking for repeated persona execution
   */
  private detectInfiniteLoop(state: GraphState): boolean {
    // Check if last 3 steps are identical personas
    const lastThree = state.executionHistory
      .filter((s) => s.nodeType === "persona")
      .slice(-3)

    if (lastThree.length === 3) {
      const personas = lastThree.map((s) => s.personaName)
      if (personas[0] === personas[1] && personas[1] === personas[2]) {
        return true
      }
    }

    return false
  }

  /**
   * Finalize execution and prepare result
   */
  private finalizeExecution(
    state: GraphState,
    firstPersona: string | null
  ): GraphState {
    console.log("\n🏁 Finalizing pipeline execution")
    console.log(`   Iterations: ${state.iterationCount}`)
    console.log(
      `   Personas executed: ${Array.from(state.personasExecuted.keys()).length}`
    )

    return {
      ...state,
      shouldSaveNote: !state.shouldDeleteNote,
      finalNote: state.currentNote,
      handledByPersona: firstPersona || undefined,
      executionHistory: [
        ...state.executionHistory,
        {
          step: state.iterationCount,
          nodeType: "end",
          timestamp: Date.now()
        }
      ]
    }
  }
}
