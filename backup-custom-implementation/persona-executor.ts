/**
 * Persona Executor
 * Executes individual persona workflows using Gemini Nano and PersonaToolkit
 */

import type { Note, Persona } from "./db-service"
import { executePrompt } from "./gemini-nano-service"
import { PersonaToolkit, type ToolResult } from "./persona-toolkit"

export interface Action {
  tool: string
  parameters: Record<string, any>
  reasoning?: string
  result?: ToolResult
  timestamp: number
}

export interface ExecutionResult {
  success: boolean
  modifiedNote?: Note
  createdNotes?: Note[]
  deletedNoteIds?: string[]
  actionsPerformed: Action[]
  error?: string
}

export class PersonaExecutor {
  constructor(
    private persona: Persona,
    private toolkit: PersonaToolkit
  ) {}

  /**
   * Execute the persona's workflow on a note
   */
  async execute(
    currentNote: Note,
    previousActions?: Action[]
  ): Promise<ExecutionResult> {
    const actionsPerformed: Action[] = []

    try {
      console.log(`🤖 Executing persona: ${this.persona.name}`)

      // 1. Build execution prompt with context from previous actions
      const prompt = this.buildExecutionPrompt(currentNote, previousActions)

      // 2. Define JSON schema for structured output
      const actionSchema = {
        type: "object",
        properties: {
          actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tool: {
                  type: "string",
                  enum: this.persona.toolsAllowed
                },
                parameters: { type: "object" },
                reasoning: { type: "string" }
              },
              required: ["tool", "parameters"]
            }
          },
          summary: { type: "string" }
        },
        required: ["actions"]
      }

      // 3. Execute prompt with Gemini Nano
      const rawResponse = await executePrompt(prompt, {
        initialPrompts: [
          {
            role: "system",
            content: this.persona.actionPrompt
          }
        ],
        temperature: 0.5,
        topK: 8, // Required: must specify both temperature and topK, or neither
        responseConstraint: actionSchema
      })

      console.log(`📝 Raw AI response:`, rawResponse)

      // 4. Parse response
      const response = JSON.parse(rawResponse)
      console.log(`✅ Parsed ${response.actions.length} actions`)

      // 5. Execute each action sequentially
      let modifiedNote = currentNote
      const createdNotes: Note[] = []
      const deletedNoteIds: string[] = []

      for (const action of response.actions) {
        console.log(`🔧 Executing tool: ${action.tool}`)

        const result = await this.toolkit.execute(
          action.tool,
          action.parameters,
          modifiedNote
        )

        const actionRecord: Action = {
          tool: action.tool,
          parameters: action.parameters,
          reasoning: action.reasoning,
          result,
          timestamp: Date.now()
        }

        actionsPerformed.push(actionRecord)

        // Update state based on action results
        if (result.success && result.data) {
          if (action.tool === "db.notes.update" && result.data.note) {
            modifiedNote = result.data.note
          } else if (action.tool === "db.notes.create" && result.data.note) {
            createdNotes.push(result.data.note)
          } else if (action.tool === "db.notes.delete" && result.data.id) {
            deletedNoteIds.push(result.data.id)
          } else if (action.tool === "db.notes.merge" && result.data.note) {
            modifiedNote = result.data.note
          }
        }
      }

      console.log(
        `✅ Persona execution complete: ${actionsPerformed.length} actions`
      )

      return {
        success: true,
        modifiedNote:
          modifiedNote.id !== currentNote.id ? modifiedNote : undefined,
        createdNotes: createdNotes.length > 0 ? createdNotes : undefined,
        deletedNoteIds: deletedNoteIds.length > 0 ? deletedNoteIds : undefined,
        actionsPerformed
      }
    } catch (error) {
      console.error(`❌ Persona ${this.persona.name} execution failed:`, error)
      return {
        success: false,
        actionsPerformed,
        error: String(error)
      }
    }
  }

  /**
   * Build the execution prompt for Gemini Nano
   */
  private buildExecutionPrompt(note: Note, previousActions?: Action[]): string {
    let contextSection = ""
    
    // Add previous actions context if available
    if (previousActions && previousActions.length > 0) {
      const lastAction = previousActions[previousActions.length - 1]
      const hasRepeatingFailure = previousActions.filter(a => 
        a.tool === lastAction.tool && 
        JSON.stringify(a.parameters) === JSON.stringify(lastAction.parameters) &&
        !a.result?.success
      ).length >= 2
      
      contextSection = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PREVIOUS ACTIONS IN THIS PIPELINE (${previousActions.length} total):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${previousActions.map((action, idx) => {
  let resultDetail = ''
  if (action.result?.success) {
    // Show detailed result data for successful actions
    if (action.result.data) {
      const data = action.result.data
      if (data.id) {
        resultDetail = `✅ SUCCESS - Created/Found note with ID: ${data.id}`
      } else if (data.note?.id) {
        resultDetail = `✅ SUCCESS - Note ID: ${data.note.id}`
      } else if (data.message) {
        resultDetail = `✅ SUCCESS - ${data.message}`
      } else {
        resultDetail = `✅ SUCCESS`
      }
    } else {
      resultDetail = '✅ SUCCESS'
    }
  } else {
    const error = action.result?.error || 'unknown error'
    resultDetail = `❌ FAILED - ${error}`
    
    // Add helpful hint for common errors
    if (error === 'Note not found') {
      resultDetail += '\n   💡 Hint: The note does not exist. You should CREATE it instead of searching again!'
    }
  }
  
  return `Action #${idx + 1}: ${action.tool}
   Parameters: ${JSON.stringify(action.parameters)}
   Result: ${resultDetail}
   Your reasoning: "${action.reasoning || 'N/A'}"`
}).join('\n\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${hasRepeatingFailure ? `⚠️  WARNING: You've tried "${lastAction.tool}" multiple times and it keeps failing!
⚠️  STOP repeating the same action. Try a DIFFERENT approach!
⚠️  If searching fails, CREATE the note instead!

` : ''}CRITICAL RULES:
1. You can ONLY plan ONE action at a time
2. After each action, you will be re-invoked to plan the next step
3. NEVER repeat a failed action - learn from failures and try something different!
4. If a note doesn't exist ("Note not found"), CREATE it instead of searching again
5. Look at the "Result" field above to extract IDs from successful create/find operations
6. Use exact IDs from previous results, never invent IDs`
    }

    return `You are executing as the "${this.persona.name}" persona.

Your mission: ${this.persona.actionPrompt}

Current Note:
- Title: ${note.title}
- Category: ${note.category}
- Content: ${note.contentPlaintext}
- Created: ${new Date(note.createdAt).toISOString()}
${contextSection}

Available Tools: ${this.persona.toolsAllowed.join(", ")}

Respond with a JSON object containing:
1. "actions": An array with EXACTLY ONE action (you can only do one thing at a time!)
2. "summary": A brief explanation of this single action

CRITICAL: Only return ONE action per response. You will be called again after it executes.

Tool Descriptions:
- db.notes.find: Find a note by title or id. Params: { title?: string, id?: string }
  Returns: { success: true, data: { note, id } } where 'id' is the note's unique ID
  
- db.notes.update: Update a note's content or metadata. Params: { id: string, content?: string, contentPlaintext?: string, title?: string, category?: string }
  CRITICAL: 'id' must be the note's ID (e.g., "note_1234_xyz"), NOT the title!
  
- db.notes.create: Create a new note. Params: { title: string, content: string, contentPlaintext: string, category?: string }
  Returns: { success: true, data: { note, id, message } } - SAVE THE 'id' field to use in subsequent actions!
  
- db.notes.delete: Delete a note. Params: { id: string }
  Requires the note's ID (e.g., "note_1234_xyz"), NOT the title
  
- db.notes.merge: Merge two notes together. Params: { sourceId: string, targetId: string, deleteSource?: boolean }

- db.notes.search: Search notes by title. Params: { query: string }

CRITICAL RULES FOR USING IDs:
1. When you CREATE a note, the result contains an 'id' field - EXTRACT and REMEMBER this ID
2. When you FIND a note, the result contains an 'id' field - EXTRACT this ID  
3. To UPDATE or DELETE a note, you MUST use its ID, never use the title
4. Look at "Previous Actions" section above to find IDs from create/find operations
5. ONLY PLAN ONE ACTION - you will be re-invoked after it executes!

Example response (SINGLE ACTION ONLY):
{
  "actions": [
    {
      "tool": "db.notes.find",
      "parameters": { "title": "Master Password List" },
      "reasoning": "First, I need to check if the list exists and get its ID"
    }
  ],
  "summary": "Searching for existing master list"
}

If you already found/created a note in a previous action, use its ID:
{
  "actions": [
    {
      "tool": "db.notes.update",
      "parameters": { 
        "id": "note_1234_xyz",  // ← Use the exact ID from "Previous Actions" above!
        "contentPlaintext": "updated content here"
      },
      "reasoning": "Using ID from previous find/create to update the note"
    }
  ],
  "summary": "Updating master list with new entry"
}

IMPORTANT: 
- You can ONLY plan ONE action at a time!
- Only use tools from the allowed list
- Ensure all required parameters are provided
- Extract IDs from "Previous Actions" results shown above
- Never invent IDs - always use the exact ID from previous results
- Return valid JSON with exactly one action`
  }
}
