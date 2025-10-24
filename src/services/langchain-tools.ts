/**
 * LangChain Tools for MindKeep
 *
 * Wraps note operations as LangChain tools for agentic workflows.
 */

import { DynamicStructuredTool } from "@langchain/core/tools"
import { z } from "zod"

import * as aiService from "./ai-service"
import type { Note } from "./db-service"
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

const GetStatisticsSchema = z.object({})

const CreateNoteFromChatSchema = z.object({
 content: z
 .string()
 .optional()
 .describe(
 "The content of the note to save. If not provided, use the last user message from conversation history."
 ),
 title: z
 .string()
 .optional()
 .describe(
 "The title for the note. If not provided, will request clarification from user or auto-generate."
 ),
 category: z
 .string()
 .optional()
 .describe(
 "The category for the note. If not provided, will suggest existing categories or auto-generate."
 ),
 skipClarification: z
 .boolean()
 .optional()
 .default(false)
 .describe(
 "If true, auto-generate missing title/category without asking user. Use when user explicitly says 'auto-generate' or similar."
 )
})

const OrganizeNoteSchema = z.object({
 noteId: z.string().describe("The unique ID of the note to organize"),
 suggestedCategory: z
 .string()
 .optional()
 .describe(
 "The suggested category to move the note to. If not provided, will search for similar notes."
 )
})

const ConfirmOrganizeNoteSchema = z.object({
 noteId: z.string().describe("The unique ID of the note to organize"),
 targetCategory: z
 .string()
 .describe("The category to move the note to after user confirmation"),
 userConfirmed: z
 .boolean()
 .describe("Whether the user confirmed the organization action")
})

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
 "Search through notes using semantic similarity and keywords. Use this when the user wants to find notes about a specific topic.",
 schema: SearchNotesSchema,
 func: async ({ query, limit = 5 }) => {
 try {
 console.log(`[Tool: search_notes] Hybrid search for: "${query}"`)

 // --- Step 1: Semantic Vector Search ---
 const embedding =
 await aiService.EmbeddingPipeline.generateEmbedding(query)
 const vectorResults = await dbService.searchNotesByVector(
 embedding,
 limit
 )

 // --- Step 2: Keyword Title Search ---
 // You already built this function, let's use it!
 const titleResults = await dbService.searchNotesByTitle(query)

 // --- Step 3: Merge and De-duplicate Results ---
 const allResults = new Map<string, any>()

 console.log(
 `[Tool: search_notes] Found ${vectorResults.length} vector results and ${titleResults.length} title results`
 )

 console.log("allResults before merging:", allResults)
 console.log("vectorResults before merging:", vectorResults)

 // Add vector results first, respecting a proper threshold
 const MIN_SIMILARITY_THRESHOLD = -0.2
 vectorResults.forEach(({ note, score }) => {
 if (score >= MIN_SIMILARITY_THRESHOLD) {
 allResults.set(note.id, { ...note, similarity: score })
 }
 })

 // Add title matches, which might not have been caught by vector search
 titleResults.forEach((note) => {
 if (!allResults.has(note.id)) {
 allResults.set(note.id, { ...note, similarity: null }) // No similarity score for keyword match
 }
 })

 // Convert map back to an array and format for the agent
 const finalResults = Array.from(allResults.values()).map((note) => {
 return {
 id: note.id,
 title: note.title,
 content: note.contentPlaintext
 .replace(/\\n/g, "\n") // Convert escaped newlines to actual newlines
 .replace(/\n{3,}/g, "\n\n") // Replace 3+ consecutive newlines with just 2
 .replace(/\n\s+\n/g, "\n\n") // Remove whitespace-only lines
 .trim(),
 category: note.category,
 similarity: note.similarity
 ? parseFloat(note.similarity.toFixed(4))
 : "keyword_match",
 updatedAt: new Date(note.updatedAt).toLocaleDateString()
 }
 })

 if (finalResults.length === 0) {
 return JSON.stringify({ success: true, message: "No notes found." })
 }

 return JSON.stringify({
 success: true,
 message: `Found ${finalResults.length} relevant note(s).`,
 notes: finalResults.slice(0, limit) // Ensure we don't exceed the limit
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

/**
 * Get Statistics Tool
 * Retrieves comprehensive statistics about notes and categories
 */
export const getStatisticsTool = new DynamicStructuredTool({
 name: "get_statistics",
 description:
 "Get comprehensive statistics about notes including total count, notes per category, and date information. Use this when the user asks about how many notes they have, note counts by category, or when notes were created/updated.",
 schema: GetStatisticsSchema,
 func: async () => {
 try {
 console.log(`[Tool: get_statistics] Retrieving database statistics`)

 const stats = await dbService.getDatabaseStatistics()

 // Format dates for better readability
 const formatDate = (timestamp: number | null) => {
 if (!timestamp) return "N/A"
 return new Date(timestamp).toLocaleDateString("en-US", {
 year: "numeric",
 month: "short",
 day: "numeric"
 })
 }

 return JSON.stringify({
 success: true,
 statistics: {
 totalNotes: stats.totalNotes,
 categoriesBreakdown: stats.categories.map((cat) => ({
 category: cat.category,
 noteCount: cat.count,
 lastUpdated: formatDate(cat.lastUpdated)
 })),
 oldestNote: formatDate(stats.oldestNoteDate),
 newestNote: formatDate(stats.newestNoteDate),
 lastModified: formatDate(stats.lastModifiedDate)
 }
 })
 } catch (error) {
 console.error("[Tool: get_statistics] Error:", error)
 return JSON.stringify({
 success: false,
 error: `Failed to get statistics: ${error.message}`
 })
 }
 }
})

/**
 * Create Note From Chat Tool
 * Creates a note from conversation with smart parameter handling
 * Handles missing title/category by requesting clarification or auto-generating
 */
export const createNoteFromChatTool = new DynamicStructuredTool({
 name: "create_note_from_chat",
 description: `Create a note from the current conversation. This is used when the user says things like:
 - "can you add this as note?"
 - "save that as a note"
 - "add this as note under aws category"
 - "add this as note with title Amazon"
 
 The tool intelligently handles missing parameters:
 - If content is missing but this is a confirmation phrase, it should already be extracted from conversation
 - If title is missing, either requests clarification or auto-generates
 - If category is missing, suggests existing categories or auto-generates
 
 Use this tool when the user wants to save information from the chat as a note.`,
 schema: CreateNoteFromChatSchema,
 func: async ({ content, title, category, skipClarification = false }) => {
 try {
 console.log(
 `[Tool: create_note_from_chat] Creating note from chat with params:`,
 { content, title, category, skipClarification }
 )

 // Determine what's missing
 const missingParams = {
 content: !content || content.trim() === "",
 title: !title,
 category: !category
 }

 console.log(
 `[Tool: create_note_from_chat] Missing params:`,
 missingParams
 )

 // If content is missing, we need to signal that we should use conversation history
 // This will be handled by the agent layer
 if (missingParams.content) {
 console.error(
 "[Tool: create_note_from_chat] Content is missing! This should have been extracted by the agent."
 )
 return JSON.stringify({
 success: false,
 needsClarification: true,
 clarificationType: "content",
 message:
 "I need to know what content to save. Could you specify what you'd like to save as a note?"
 })
 }

 // If title or category is missing and skipClarification is false, request clarification
 if (
 !skipClarification &&
 (missingParams.title || missingParams.category)
 ) {
 // Get all existing categories for suggestions
 const existingCategories = await dbService.getAllCategories()

 return JSON.stringify({
 success: false,
 needsClarification: true,
 clarificationType:
 missingParams.title && missingParams.category
 ? "both"
 : missingParams.title
 ? "title"
 : "category",
 missingParams: {
 title: missingParams.title,
 category: missingParams.category
 },
 existingCategories: existingCategories,
 noteContent: content, // Pass content so it can be used for generation
 message:
 missingParams.title && missingParams.category
 ? "I can create this note for you! Would you like me to auto-generate a title and category, or would you prefer to provide them?"
 : missingParams.title
 ? "Would you like me to auto-generate a title, or would you prefer to provide one?"
 : "Which category would you like to use? I can suggest existing ones or create a new category."
 })
 }

 // If we reach here, either all params are provided or skipClarification is true
 // In case of skipClarification, the agent should have auto-generated missing values

 // Actually create the note if we have all required params
 if (title && category && content) {
 try {
 // Generate embedding for the content
 const embedding = await aiService.generateEmbedding(content)

 // Create the note via dbService
 const createdNote = await dbService.addNote({
 title: title,
 content: content,
 contentPlaintext: content, // For chat-created notes, content is already plaintext
 category: category,
 embedding: embedding
 })

 console.log(
 `[Tool: create_note_from_chat] Note created successfully with ID: ${createdNote.id}`
 )

 return JSON.stringify({
 success: true,
 noteCreated: true,
 message: `I have created a new note titled "${title}" under the category "${category}" containing the following information:\n\n${content}`,
 noteData: {
 id: createdNote.id, // Only return the ID, not the full note object with embedding
 title: title,
 content: content,
 category: category
 }
 })
 } catch (error) {
 console.error(
 "[Tool: create_note_from_chat] Failed to create note:",
 error
 )
 return JSON.stringify({
 success: false,
 message: `Failed to create note: ${error.message}`
 })
 }
 }

 // Fallback: return metadata without creating
 return JSON.stringify({
 success: true,
 message: `Note will be created with title "${title || "Auto-generated"}" under category "${category || "general"}".`,
 noteData: {
 title: title || "Untitled Note",
 content: content,
 category: category || "general"
 }
 })
 } catch (error) {
 console.error("[Tool: create_note_from_chat] Error:", error)
 return JSON.stringify({
 success: false,
 error: `Failed to create note from chat: ${error.message}`
 })
 }
 }
})

/**
 * Organize Note Tool
 * Finds semantically similar notes and suggests category reorganization
 * This tool should be called automatically after a note is created
 */
export const organizeNoteTool = new DynamicStructuredTool({
 name: "organize_note",
 description: `Organize a newly created note by finding semantically similar notes and suggesting better category placement.
 
 This tool analyzes the note's title and content to find related notes in the database.
 If related notes are found in a different category, it suggests reorganizing the note.
 
 Call this tool automatically after creating a note to help maintain organized categories.`,
 schema: OrganizeNoteSchema,
 func: async ({ noteId, suggestedCategory }) => {
 try {
 console.log(
 `[Tool: organize_note] Organizing note: ${noteId}, suggested: ${suggestedCategory}`
 )

 // Get the note that was just created
 const note = await dbService.getNote(noteId)
 if (!note) {
 return JSON.stringify({
 success: false,
 error: `Note with ID "${noteId}" not found.`
 })
 }

 console.log(
 `[Tool: organize_note] Found note: "${note.title}" in category "${note.category}"`
 )

 // Search for semantically similar notes based on title and content
 const searchQuery = `${note.title} ${note.contentPlaintext}`.substring(
 0,
 500
 ) // Limit search query length
 const embedding = await aiService.generateEmbedding(searchQuery)
 const similarNotes = await dbService.searchNotesByVector(embedding, 10) // Get top 10 similar notes

 console.log(
 `[Tool: organize_note] Found ${similarNotes.length} similar notes`
 )

 // Filter out the note itself and group by category
 const otherNotes = similarNotes.filter(
 (result) => result.note.id !== noteId
 )
 const categoryGroups = new Map<
 string,
 Array<{ note: Note; score: number }>
 >()

 otherNotes.forEach((result) => {
 const category = result.note.category
 if (!categoryGroups.has(category)) {
 categoryGroups.set(category, [])
 }
 categoryGroups.get(category)!.push(result)
 })

 console.log(
 `[Tool: organize_note] Category groups:`,
 Array.from(categoryGroups.keys())
 )

 // Remove the current note's category from suggestions
 categoryGroups.delete(note.category)

 // If no similar notes in other categories, no reorganization needed
 if (categoryGroups.size === 0) {
 console.log(
 `[Tool: organize_note] No similar notes found in other categories`
 )
 return JSON.stringify({
 success: true,
 needsReorganization: false,
 message: `The note "${note.title}" is already in a good category. No reorganization needed.`
 })
 }

 // Find the category with the most similar notes
 let bestCategory = ""
 let maxCount = 0
 let relatedNotesInBestCategory: Array<{ note: Note; score: number }> = []

 categoryGroups.forEach((notes, category) => {
 if (notes.length > maxCount) {
 maxCount = notes.length
 bestCategory = category
 relatedNotesInBestCategory = notes
 }
 })

 console.log(
 `[Tool: organize_note] Best matching category: "${bestCategory}" with ${maxCount} notes`
 )

 // Prepare suggestion for user
 const relatedTitles = relatedNotesInBestCategory
 .slice(0, 3)
 .map((result) => `• ${result.note.title}`)
 .join("\n")

 return JSON.stringify({
 success: true,
 needsReorganization: true,
 noteId: noteId,
 currentCategory: note.category,
 suggestedCategory: bestCategory,
 relatedNotesCount: maxCount,
 relatedNotesTitles: relatedTitles,
 message: `Hey! I found that there's an existing category called "${bestCategory}" with ${maxCount} related note${maxCount > 1 ? "s" : ""}:\n\n${relatedTitles}\n\nWould you like to move the note "${note.title}" from "${note.category}" to "${bestCategory}" to keep related notes organized together?`
 })
 } catch (error) {
 console.error("[Tool: organize_note] Error:", error)
 return JSON.stringify({
 success: false,
 error: `Failed to organize note: ${error.message}`
 })
 }
 }
})

/**
 * Confirm Organize Note Tool
 * Executes the category reorganization after user confirmation
 */
export const confirmOrganizeNoteTool = new DynamicStructuredTool({
 name: "confirm_organize_note",
 description: `Confirm and execute the note reorganization based on user's response.
 
 Call this tool after the user has responded to the organization suggestion from organize_note tool.
 If user confirms (says yes/sure/ok), move the note to the suggested category.
 If user declines (says no/not now), keep the note in its current category.`,
 schema: ConfirmOrganizeNoteSchema,
 func: async ({ noteId, targetCategory, userConfirmed }) => {
 try {
 console.log(
 `[Tool: confirm_organize_note] User ${userConfirmed ? "confirmed" : "declined"} moving note ${noteId} to ${targetCategory}`
 )

 const note = await dbService.getNote(noteId)
 if (!note) {
 return JSON.stringify({
 success: false,
 error: `Note with ID "${noteId}" not found.`
 })
 }

 if (!userConfirmed) {
 console.log(
 `[Tool: confirm_organize_note] User declined reorganization`
 )
 return JSON.stringify({
 success: true,
 action: "declined",
 message: `Okay, I'll keep "${note.title}" in the "${note.category}" category.`
 })
 }

 // User confirmed - update the note's category
 console.log(
 `[Tool: confirm_organize_note] Moving note from "${note.category}" to "${targetCategory}"`
 )

 const updatedNote = await dbService.updateNote(noteId, {
 category: targetCategory
 })

 if (!updatedNote) {
 return JSON.stringify({
 success: false,
 error: `Failed to update note category.`
 })
 }

 console.log(
 `[Tool: confirm_organize_note] Successfully moved note to "${targetCategory}"`
 )

 return JSON.stringify({
 success: true,
 action: "moved",
 message: `Perfect! I've moved "${note.title}" to the "${targetCategory}" category. Your notes are now better organized.`,
 updatedNote: {
 id: updatedNote.id,
 title: updatedNote.title,
 category: updatedNote.category
 }
 })
 } catch (error) {
 console.error("[Tool: confirm_organize_note] Error:", error)
 return JSON.stringify({
 success: false,
 error: `Failed to confirm organization: ${error.message}`
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
 listCategoriesTool,
 getStatisticsTool,
 createNoteFromChatTool,
 organizeNoteTool,
 confirmOrganizeNoteTool
]

/**
 * Read-only tools (safe for any context)
 */
export const readOnlyTools = [
 searchNotesTool,
 getNoteTool,
 listCategoriesTool,
 getStatisticsTool
]

/**
 * Get tools by names
 */
export function getToolsByNames(names: string[]) {
 return allTools.filter((tool) => names.includes(tool.name))
}
