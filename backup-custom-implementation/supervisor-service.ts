/**
 * Supervisor Service
 * Routes notes to appropriate personas using Gemini Nano classification
 */

import type { Persona } from "./db-service"
import { executePrompt } from "./gemini-nano-service"

/**
 * Classify a note and determine which persona should handle it
 * Returns the persona name or null if no match
 */
export async function classifyNote(
  noteContent: string,
  availablePersonas: Persona[]
): Promise<string | null> {
  if (availablePersonas.length === 0) {
    return null
  }

  try {
    // Build dynamic prompt with all available personas
    const personaDescriptions = availablePersonas
      .map(
        (p, idx) =>
          `${idx + 1}. "${p.name}" (Priority: ${p.priority}): ${p.triggerPrompt}`
      )
      .join("\n")

    const prompt = `You are an intelligent routing agent. Analyze the note content and determine which persona should handle it next.

Available Personas (sorted by priority):
${personaDescriptions}

Note Content:
"""
${noteContent}
"""

Rules:
- Respond with ONLY the exact persona name (e.g., "Password Librarian")
- If multiple personas match, choose the HIGHEST priority (lowest priority number)
- If no persona matches, respond with "none"
- Be precise - only match if the trigger condition is clearly met
- Look for specific keywords and patterns mentioned in the trigger prompts

Your response (persona name or "none"):`

    const result = await executePrompt(prompt, {
      temperature: 0.3, // Low temperature for consistent routing
      topK: 1 // Deterministic selection
    })

    const cleaned = result.trim().toLowerCase()

    console.log(`🧠 Supervisor classification: "${cleaned}"`)

    // Validate response is "none"
    if (cleaned === "none") {
      return null
    }

    // Find matching persona (case-insensitive)
    const matched = availablePersonas.find(
      (p) => p.name.toLowerCase() === cleaned
    )

    if (matched) {
      console.log(`✅ Matched persona: ${matched.name}`)
      return matched.name
    }

    // If we got a response but couldn't match it, log warning
    console.warn(
      `⚠️  Supervisor returned "${result}" but no matching persona found`
    )
    return null
  } catch (error) {
    console.error("❌ Supervisor classification failed:", error)
    return null
  }
}
