/**
 * LangChain Tools for MindKeep
 *
 * Wraps note operations as LangChain tools for agentic workflows.
 */

import { DynamicStructuredTool } from "@langchain/core/tools"
import { z } from "zod"

import * as aiService from "./ai-service"
import * as dbService from "./db-service"

// ============================================================================
// TOOL SCHEMAS (using Zod for validation)
// ============================================================================

const SearchNotesSchema = z.object({
  query: z.string().describe("The search query to find relevant notes"),
  limit: z
    .number()
    .optional()
    .default(5)
    .describe("Maximum number of results to return (default: 5)")
})

const GetNoteSchema = z.object({
  noteId: z.string().describe("The unique ID of the note to retrieve")
})

const CreateNoteSchema = z.object({
  title: z.string().describe("The title of the new note"),
  content: z
    .string()
    .describe("The content of the note (plain text or rich text JSON)"),
  category: z
    .string()
    .optional()
    .describe("The category for the note (default: 'general')")
})

const UpdateNoteSchema = z.object({
  noteId: z.string().describe("The unique ID of the note to update"),
  title: z.string().optional().describe("New title for the note"),
  content: z.string().optional().describe("New content for the note"),
  category: z.string().optional().describe("New category for the note")
})

const DeleteNoteSchema = z.object({
  noteId: z.string().describe("The unique ID of the note to delete")
})

const ListCategoriesSchema = z.object({})

// ============================================================================
// TOOLS IMPLEMENTATION
// ============================================================================

/**
 * Search Notes Tool
 * Performs semantic search through user's notes
 */
export const searchNotesTool = new DynamicStructuredTool({
  name: "search_notes",
  description:
    "Search through notes using semantic similarity. Use this when the user wants to find notes about a specific topic or asks questions about their notes.",
  schema: SearchNotesSchema,
  func: async ({ query, limit = 5 }) => {
    try {
      console.log(
        `[Tool: search_notes] Searching for: "${query}" (limit: ${limit})`
      )

      // Generate embedding for the query
      const embedding =
        await aiService.EmbeddingPipeline.generateEmbedding(query)

      // Search using vector similarity
      const results = await dbService.searchNotesByVector(embedding, limit)

      console.log(
        `[Tool: search_notes] Retrieved ${results.length} results from vector search. Filtering...`
      )

      // Filter out results with similarity score below 0.1 (minimum threshold)
      const MIN_SIMILARITY_THRESHOLD = 0
      const filteredResults = results.filter(
        ({ score }) => score >= MIN_SIMILARITY_THRESHOLD
      )

      if (filteredResults.length === 0) {
        return JSON.stringify({
          success: true,
          message: "No notes found matching your query.",
          notes: []
        })
      }

      // Return simplified note info with similarity scores
      // Clean up plain text: remove excessive newlines and whitespace
      const formattedResults = filteredResults.map(({ note, score }) => ({
        id: note.id,
        title: note.title,
        content: note.contentPlaintext
          .replace(/\\n/g, "\n") // Convert escaped newlines to actual newlines
          .replace(/\n{3,}/g, "\n\n") // Replace 3+ consecutive newlines with just 2
          .replace(/\n\s+\n/g, "\n\n") // Remove whitespace-only lines
          .trim(), // Remove leading/trailing whitespace
        category: note.category,
        similarity: parseFloat(score.toFixed(4)), // Similarity score (0-1, higher is better)
        createdAt: new Date(note.createdAt).toLocaleDateString(),
        updatedAt: new Date(note.updatedAt).toLocaleDateString()
      }))

      console.log(
        "[Tool: search_notes] Search results:",
        JSON.stringify(formattedResults, null, 200)
      )

      console.log(
        `[Tool: search_notes] Filtered ${results.length - filteredResults.length} results below similarity threshold of ${MIN_SIMILARITY_THRESHOLD}`
      )

      return JSON.stringify({
        success: true,
        message: `Found ${filteredResults.length} relevant note(s).`,
        notes: formattedResults
      })
    } catch (error) {
      console.error("[Tool: search_notes] Error:", error)
      return JSON.stringify({
        success: false,
        error: `Failed to search notes: ${error.message}`
      })
    }
  }
})

/**
 * Get Note Tool
 * Retrieves a specific note by ID
 */
export const getNoteTool = new DynamicStructuredTool({
  name: "get_note",
  description:
    "Retrieve a specific note by its ID. Use this when you need the full details of a particular note.",
  schema: GetNoteSchema,
  func: async ({ noteId }) => {
    try {
      console.log(`[Tool: get_note] Retrieving note: ${noteId}`)

      const note = await dbService.getNote(noteId)

      if (!note) {
        return JSON.stringify({
          success: false,
          message: `Note with ID "${noteId}" not found.`
        })
      }

      return JSON.stringify({
        success: true,
        note: {
          id: note.id,
          title: note.title,
          content: note.contentPlaintext
            .replace(/\\n/g, "\n") // Convert escaped newlines to actual newlines
            .replace(/\n{3,}/g, "\n\n") // Replace 3+ consecutive newlines with just 2
            .replace(/\n\s+\n/g, "\n\n") // Remove whitespace-only lines
            .trim(), // Remove leading/trailing whitespace
          category: note.category,
          createdAt: new Date(note.createdAt).toLocaleDateString(),
          updatedAt: new Date(note.updatedAt).toLocaleDateString(),
          sourceUrl: note.sourceUrl
        }
      })
    } catch (error) {
      console.error("[Tool: get_note] Error:", error)
      return JSON.stringify({
        success: false,
        error: `Failed to retrieve note: ${error.message}`
      })
    }
  }
})

/**
 * Create Note Tool
 * Creates a new note
 */
export const createNoteTool = new DynamicStructuredTool({
  name: "create_note",
  description:
    "Create a new note with the given title, content, and optional category. Use this when the user wants to save new information.",
  schema: CreateNoteSchema,
  func: async ({ title, content, category = "general" }) => {
    try {
      console.log(`[Tool: create_note] Creating note: "${title}"`)

      // This tool should be called from background script context where encryption is available
      // For now, return a message indicating the note would be created
      // In full implementation, this would call the background script

      return JSON.stringify({
        success: true,
        message: `Note creation requested: "${title}" in category "${category}". This will be processed by the background script.`,
        noteData: {
          title,
          content,
          category
        }
      })
    } catch (error) {
      console.error("[Tool: create_note] Error:", error)
      return JSON.stringify({
        success: false,
        error: `Failed to create note: ${error.message}`
      })
    }
  }
})

/**
 * Update Note Tool
 * Updates an existing note
 */
export const updateNoteTool = new DynamicStructuredTool({
  name: "update_note",
  description:
    "Update an existing note's title, content, or category. Use this when the user wants to modify a note.",
  schema: UpdateNoteSchema,
  func: async ({ noteId, title, content, category }) => {
    try {
      console.log(`[Tool: update_note] Updating note: ${noteId}`)

      // Check if note exists
      const existingNote = await dbService.getNote(noteId)
      if (!existingNote) {
        return JSON.stringify({
          success: false,
          message: `Note with ID "${noteId}" not found.`
        })
      }

      return JSON.stringify({
        success: true,
        message: `Note update requested for "${existingNote.title}". This will be processed by the background script.`,
        updates: { noteId, title, content, category }
      })
    } catch (error) {
      console.error("[Tool: update_note] Error:", error)
      return JSON.stringify({
        success: false,
        error: `Failed to update note: ${error.message}`
      })
    }
  }
})

/**
 * Delete Note Tool
 * Deletes a note
 */
export const deleteNoteTool = new DynamicStructuredTool({
  name: "delete_note",
  description:
    "Delete a note by its ID. Use this when the user explicitly wants to remove a note.",
  schema: DeleteNoteSchema,
  func: async ({ noteId }) => {
    try {
      console.log(`[Tool: delete_note] Deleting note: ${noteId}`)

      // Check if note exists first
      const note = await dbService.getNote(noteId)
      if (!note) {
        return JSON.stringify({
          success: false,
          message: `Note with ID "${noteId}" not found.`
        })
      }

      await dbService.deleteNote(noteId)

      return JSON.stringify({
        success: true,
        message: `Successfully deleted note: "${note.title}"`
      })
    } catch (error) {
      console.error("[Tool: delete_note] Error:", error)
      return JSON.stringify({
        success: false,
        error: `Failed to delete note: ${error.message}`
      })
    }
  }
})

/**
 * List Categories Tool
 * Lists all unique categories
 */
export const listCategoriesTool = new DynamicStructuredTool({
  name: "list_categories",
  description:
    "Get a list of all note categories. Use this when the user wants to see what categories they have.",
  schema: ListCategoriesSchema,
  func: async () => {
    try {
      console.log(`[Tool: list_categories] Listing all categories`)

      const categories = await dbService.getAllCategories()

      return JSON.stringify({
        success: true,
        categories: categories
      })
    } catch (error) {
      console.error("[Tool: list_categories] Error:", error)
      return JSON.stringify({
        success: false,
        error: `Failed to list categories: ${error.message}`
      })
    }
  }
})

// ============================================================================
// TOOL COLLECTION
// ============================================================================

/**
 * All available tools for the agent
 */
export const allTools = [
  searchNotesTool,
  getNoteTool,
  createNoteTool,
  updateNoteTool,
  deleteNoteTool,
  listCategoriesTool
]

/**
 * Read-only tools (safe for any context)
 */
export const readOnlyTools = [searchNotesTool, getNoteTool, listCategoriesTool]

/**
 * Get tools by names
 */
export function getToolsByNames(names: string[]) {
  return allTools.filter((tool) => names.includes(tool.name))
}
