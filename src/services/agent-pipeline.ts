/**
 * Agent Pipeline
 * Main orchestrator for the multi-pass agent system
 * Integrates with background script to run personas on note save
 */

import type { Note } from "./db-service"
import { GraphEngine, type GraphState } from "./graph-engine"
import { getAllPersonas, addPersona, updatePersona, getPersonaByName } from "./db-service"
import { DEFAULT_PERSONAS } from "~data/default-personas"

export interface AgentSettings {
  enabled: boolean
  maxGlobalIterations: number
  enableLogging: boolean
}

/**
 * Get agent settings from chrome.storage
 */
export async function getAgentSettings(): Promise<AgentSettings> {
  try {
    const result = await chrome.storage.local.get("agentSettings")

    if (result.agentSettings) {
      return result.agentSettings
    }

    // Default settings
    const defaults: AgentSettings = {
      enabled: true, // Agents enabled by default
      maxGlobalIterations: 10,
      enableLogging: true
    }

    await setAgentSettings(defaults)
    return defaults
  } catch (error) {
    console.error("Error getting agent settings:", error)
    return {
      enabled: true,
      maxGlobalIterations: 10,
      enableLogging: true
    }
  }
}

/**
 * Save agent settings to chrome.storage
 */
export async function setAgentSettings(
  settings: AgentSettings
): Promise<void> {
  try {
    await chrome.storage.local.set({ agentSettings: settings })
  } catch (error) {
    console.error("Error saving agent settings:", error)
  }
}

/**
 * Ensure default personas are installed and up-to-date
 * This handles both initial installation and updates to existing personas
 */
async function ensurePersonasInstalled(): Promise<void> {
  try {
    const existingPersonas = await getAllPersonas()
    
    if (existingPersonas.length === 0) {
      // Fresh install - add all default personas
      console.log("⚠️  No personas found - installing defaults...")
      
      for (const personaData of DEFAULT_PERSONAS) {
        await addPersona(personaData)
        console.log(`✅ Installed persona: ${personaData.name}`)
      }
      
      console.log("✅ Default personas installed successfully")
    } else {
      // Update existing personas with new settings (e.g., maxIterations)
      for (const defaultPersona of DEFAULT_PERSONAS) {
        const existing = await getPersonaByName(defaultPersona.name)
        
        if (existing) {
          // Update only if maxIterations has changed
          if (existing.maxIterations !== defaultPersona.maxIterations) {
            console.log(`🔄 Updating ${defaultPersona.name}: maxIterations ${existing.maxIterations} → ${defaultPersona.maxIterations}`)
            await updatePersona(existing.id, {
              maxIterations: defaultPersona.maxIterations
            })
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Error ensuring personas installed:", error)
  }
}

/**
 * Run the agent pipeline on a note
 * This is called from the background script when a note is saved
 */
export async function runAgentPipeline(input: {
  note: Note
  embedding: number[]
  encryptedContent: string
  runAgents?: boolean // Per-note override
}): Promise<GraphState> {
  try {
    // CRITICAL: Ensure personas are installed before running pipeline
    await ensurePersonasInstalled()
    
    // Check global settings
    const settings = await getAgentSettings()

    // Check if agents are globally disabled or per-note disabled
    if (!settings.enabled || input.runAgents === false) {
      console.log("⏭️  Agent pipeline skipped (disabled)")
      return {
        originalNote: input.note,
        currentNote: input.note,
        embedding: input.embedding,
        encryptedContent: input.encryptedContent,
        executionHistory: [],
        iterationCount: 0,
        maxIterations: 0,
        lastMatchedPersona: null,
        personasExecuted: new Map(),
        shouldSaveNote: true,
        shouldDeleteNote: false,
        finalNote: input.note
      }
    }

    console.log("🚀 Agent pipeline enabled - starting execution")

    // Initialize graph state
    const initialState: GraphState = {
      originalNote: input.note,
      currentNote: input.note,
      embedding: input.embedding,
      encryptedContent: input.encryptedContent,
      executionHistory: [],
      iterationCount: 0,
      maxIterations: settings.maxGlobalIterations,
      lastMatchedPersona: null,
      personasExecuted: new Map(),
      createdNotes: [], // Track notes created during pipeline
      shouldSaveNote: true,
      shouldDeleteNote: false
    }

    // Create and run graph engine
    const engine = new GraphEngine()
    const result = await engine.run(initialState)

    console.log("\n✅ Agent Pipeline Complete")
    console.log(`   - Iterations: ${result.iterationCount}`)
    console.log(
      `   - Personas executed: ${Array.from(result.personasExecuted.keys()).length}`
    )
    console.log(
      `   - Final action: ${result.shouldSaveNote ? "SAVE" : "DELETE"}`
    )

    if (settings.enableLogging) {
      console.log(`   - Execution history:`, result.executionHistory)
    }

    return result
  } catch (error) {
    console.error("❌ Agent pipeline error:", error)

    // Return safe fallback - save the original note
    return {
      originalNote: input.note,
      currentNote: input.note,
      embedding: input.embedding,
      encryptedContent: input.encryptedContent,
      executionHistory: [],
      iterationCount: 0,
      maxIterations: 10,
      lastMatchedPersona: null,
      personasExecuted: new Map(),
      createdNotes: [],
      shouldSaveNote: true,
      shouldDeleteNote: false,
      finalNote: input.note
    }
  }
}
