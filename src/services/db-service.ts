/**
 * Database service for MindKeep
 * Manages all database interactions using Dexie.js (wrapper over IndexedDB)
 *
 * CRITICAL: This service stores and retrieves data AS-IS.
 * It does NOT generate embeddings - that is done by ai-service.ts in the background script
 * It does NOT encrypt/decrypt - that is done by crypto.ts in the background script
 *
 * The background script orchestrates the full pipeline:
 * SAVE: Receive data → Generate embedding → Encrypt content → Store here
 * RETRIEVE: Fetch from here → Decrypt content → Return to UI
 */

import Dexie, { type Table } from "dexie"

import type { Persona, PersonaInput } from "~types/persona"
import { decrypt } from "~util/crypto"

// Note interface (decrypted, user-facing format)
export interface Note {
 id: string
 title: string
 content: string // Rich text JSON (decrypted, for display in TipTap)
 contentPlaintext: string // Plain text extracted from rich text (decrypted, for search)
 category: string
 embedding?: number[]
 createdAt: number
 updatedAt: number
 sourceUrl?: string
}

// Internal storage format (content is encrypted at rest)
export interface StoredNote {
 id: string
 title: string // Plaintext for searching/filtering
 content: string // ENCRYPTED TipTap JSON (base64 string) - stored as "content" in DB
 contentPlaintext: string // ENCRYPTED plain text for search (base64 string)
 category: string // Plaintext for filtering
 embedding?: number[] // Plaintext vector for semantic search
 createdAt: number
 updatedAt: number
 sourceUrl?: string
}

/**
 * Dexie Database Class
 * Defines the schema and provides typed access to tables
 */
class MindKeepDatabase extends Dexie {
 notes!: Table<StoredNote, string> // StoredNote type, string key (id)
 personas!: Table<Persona, string> // Persona type, string key (id)

 constructor() {
 super("mindkeep_db")

 // Define schema
 // The string after the & symbol defines indexes
 // Primary key (id) is automatically indexed
 // Version 2: Added contentPlaintext field for rich text support
 this.version(2).stores({
 notes: "id, category, updatedAt, createdAt, title" // indexed fields for fast queries
 })

 // Version 3: Added personas table
 this.version(3).stores({
 notes: "id, category, updatedAt, createdAt, title",
 personas: "id, name, createdAt, updatedAt, isActive, isDefault" // indexed fields for personas
 })
 }
}

// Create singleton database instance
const db = new MindKeepDatabase()

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
 if (a.length !== b.length) return 0

 let dotProduct = 0
 let magnitudeA = 0
 let magnitudeB = 0

 for (let i = 0; i < a.length; i++) {
 dotProduct += a[i] * b[i]
 magnitudeA += a[i] * a[i]
 magnitudeB += b[i] * b[i]
 }

 magnitudeA = Math.sqrt(magnitudeA)
 magnitudeB = Math.sqrt(magnitudeB)

 if (magnitudeA === 0 || magnitudeB === 0) return 0

 return dotProduct / (magnitudeA * magnitudeB)
}

/**
 * Generate a unique ID for a note
 */
function generateId(): string {
 return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Add a new note to the database
 *
 * IMPORTANT: This function expects the data to be PRE-PROCESSED by the background script:
 * - content should be ENCRYPTED TipTap JSON (base64 string from crypto.encrypt())
 * - contentPlaintext should be ENCRYPTED plain text (base64 string from crypto.encrypt())
 * - embedding should be GENERATED (number array from ai-service.generateEmbedding())
 *
 * This function ONLY stores the data as provided.
 *
 * @param noteData - Pre-processed note data with encrypted content and generated embedding
 * @returns The stored note metadata (with encrypted content)
 */
export async function addNote(noteData: {
 title: string
 content: string // ENCRYPTED TipTap JSON (base64 string)
 contentPlaintext: string // ENCRYPTED plain text (base64 string)
 category?: string
 sourceUrl?: string
 embedding?: number[] // Pre-generated embedding vector
}): Promise<StoredNote> {
 try {
 const id = generateId()
 const now = Date.now()

 console.log(
 ` [DB Service] addNote() called for title: "${noteData.title}"`,
 {
 id,
 timestamp: now
 }
 )

 const storedNote: StoredNote = {
 id,
 title: noteData.title,
 content: noteData.content, // Store encrypted TipTap JSON as-is
 contentPlaintext: noteData.contentPlaintext, // Store encrypted plaintext as-is
 category: noteData.category || "general",
 embedding: noteData.embedding, // Store embedding as-is
 createdAt: now,
 updatedAt: now,
 sourceUrl: noteData.sourceUrl
 }

 await db.notes.add(storedNote)
 return storedNote
 } catch (error) {
 console.error("Error adding note:", error)
 throw new Error("Failed to add note")
 }
}

/**
 * Get a single note by ID and decrypt its content
 *
 * IMPORTANT: This function retrieves the stored note and decrypts both the
 * TipTap JSON content and plaintext content before returning.
 *
 * @param id - The unique ID of the note
 * @returns The note with decrypted content, or null if not found
 */
export async function getNote(id: string): Promise<Note | null> {
 try {
 const storedNote = await db.notes.get(id)

 if (!storedNote) {
 return null
 }

 // Decrypt both content fields
 const content = await decrypt(storedNote.content)
 const contentPlaintext = await decrypt(storedNote.contentPlaintext)

 return {
 id: storedNote.id,
 title: storedNote.title,
 content, // Decrypted TipTap JSON
 contentPlaintext, // Decrypted plain text
 category: storedNote.category,
 embedding: storedNote.embedding,
 createdAt: storedNote.createdAt,
 updatedAt: storedNote.updatedAt,
 sourceUrl: storedNote.sourceUrl
 }
 } catch (error) {
 console.error("Error getting note:", error)
 return null
 }
}

/**
 * Update an existing note
 *
 * IMPORTANT: If content is provided in updates, it should be PRE-ENCRYPTED.
 * If contentPlaintext is provided, it should be PRE-ENCRYPTED.
 * If embedding is provided, it should be PRE-GENERATED.
 * The background script handles encryption/embedding before calling this.
 *
 * @param id - The unique ID of the note to update
 * @param updates - The fields to update (content should be encrypted if provided)
 * @returns The updated note with decrypted content
 */
export async function updateNote(
 id: string,
 updates: {
 title?: string
 content?: string // If provided, should be ENCRYPTED TipTap JSON
 contentPlaintext?: string // If provided, should be ENCRYPTED plain text
 category?: string
 embedding?: number[] // If provided, should be pre-generated
 }
): Promise<Note | null> {
 try {
 // Get existing stored note (with encrypted content)
 const existingStoredNote = await db.notes.get(id)

 if (!existingStoredNote) {
 return null
 }

 const updatedNote: StoredNote = {
 id,
 title: updates.title ?? existingStoredNote.title,
 content: updates.content ?? existingStoredNote.content, // Use encrypted content as-is
 contentPlaintext:
 updates.contentPlaintext ?? existingStoredNote.contentPlaintext, // Use encrypted plaintext as-is
 category: updates.category ?? existingStoredNote.category,
 embedding: updates.embedding ?? existingStoredNote.embedding,
 createdAt: existingStoredNote.createdAt,
 updatedAt: Date.now(),
 sourceUrl: existingStoredNote.sourceUrl
 }

 await db.notes.put(updatedNote)

 // Decrypt both content fields for return value
 const content = await decrypt(updatedNote.content)
 const contentPlaintext = await decrypt(updatedNote.contentPlaintext)

 return {
 id: updatedNote.id,
 title: updatedNote.title,
 content, // Decrypted TipTap JSON
 contentPlaintext, // Decrypted plain text
 category: updatedNote.category,
 embedding: updatedNote.embedding,
 createdAt: updatedNote.createdAt,
 updatedAt: updatedNote.updatedAt,
 sourceUrl: updatedNote.sourceUrl
 }
 } catch (error) {
 console.error("Error updating note:", error)
 return null
 }
}

/**
 * Delete a note
 */
export async function deleteNote(id: string): Promise<boolean> {
 try {
 await db.notes.delete(id)
 return true
 } catch (error) {
 console.error("Error deleting note:", error)
 return false
 }
}

/**
 * Get all stored notes (internal function, returns encrypted content)
 *
 * INTERNAL USE ONLY: Returns notes with encrypted content.
 * Used for vector search operations where we don't need to decrypt all notes.
 *
 * @returns Array of stored notes with encrypted content
 */
async function getAllStoredNotes(): Promise<StoredNote[]> {
 try {
 return await db.notes.toArray()
 } catch (error) {
 console.error("Error getting stored notes:", error)
 return []
 }
}

/**
 * Get all notes and decrypt their content
 *
 * IMPORTANT: This function retrieves all stored notes and decrypts both
 * content fields before returning. Used by the Side Panel to display notes.
 *
 * @returns Array of notes with decrypted content, sorted by updatedAt (newest first)
 */
export async function getAllNotes(): Promise<Note[]> {
 try {
 const storedNotes = await getAllStoredNotes()
 const notes: Note[] = []

 for (const storedNote of storedNotes) {
 try {
 // Decrypt both content fields
 const content = await decrypt(storedNote.content)
 const contentPlaintext = await decrypt(storedNote.contentPlaintext)
 notes.push({
 id: storedNote.id,
 title: storedNote.title,
 content, // Decrypted TipTap JSON
 contentPlaintext, // Decrypted plain text
 category: storedNote.category,
 embedding: storedNote.embedding,
 createdAt: storedNote.createdAt,
 updatedAt: storedNote.updatedAt,
 sourceUrl: storedNote.sourceUrl
 })
 } catch (error) {
 console.error(`Error decrypting note ${storedNote.id}:`, error)
 }
 }

 notes.sort((a, b) => b.updatedAt - a.updatedAt)
 return notes
 } catch (error) {
 console.error("Error getting all notes:", error)
 return []
 }
}

/**
 * Search notes by vector similarity (optimized with Dexie)
 *
 * IMPORTANT: This function performs semantic search using pre-generated embeddings.
 * The query embedding should be generated by the background script before calling this.
 *
 * OPTIMIZATION: This function efficiently loads all notes at once (fast with Dexie),
 * calculates similarity scores in memory, and only decrypts the top matching results.
 * This is much faster than decrypting everything upfront.
 *
 * @param vector - The query embedding vector (from ai-service.generateEmbedding)
 * @param limit - Maximum number of results to return
 * @returns Array of notes with decrypted content, sorted by similarity score (highest first)
 */
export async function searchNotesByVector(
 vector: number[],
 limit: number = 5
): Promise<Array<{ note: Note; score: number }>> {
 const startTime = performance.now()

 try {
 // Efficiently get all stored notes with Dexie (returns encrypted content)
 const fetchStartTime = performance.now()
 const storedNotes = await db.notes
 .filter((note) => note.embedding && note.embedding.length > 0)
 .toArray()
 const fetchTime = performance.now() - fetchStartTime
 console.log(
 `⏱ [DB Vector Search] Fetch notes from DB: ${fetchTime.toFixed(2)}ms (${storedNotes.length} notes)`
 )

 if (storedNotes.length === 0) {
 console.log(` [DB Vector Search] No notes with embeddings found`)
 return []
 }

 // Calculate similarity scores (fast, in-memory operation)
 const scoreStartTime = performance.now()
 const scored = storedNotes.map((note) => ({
 note,
 score: cosineSimilarity(vector, note.embedding!)
 }))
 const scoreTime = performance.now() - scoreStartTime
 console.log(
 `⏱ [DB Vector Search] Calculate similarity scores: ${scoreTime.toFixed(2)}ms`
 )

 // Sort by score (descending) and take top results
 const sortStartTime = performance.now()
 scored.sort((a, b) => b.score - a.score)
 const topResults = scored.slice(0, limit)
 const sortTime = performance.now() - sortStartTime
 console.log(
 `⏱ [DB Vector Search] Sort and slice top ${limit} results: ${sortTime.toFixed(2)}ms`
 )

 // Decrypt ONLY the top matching notes (critical optimization)
 const decryptStartTime = performance.now()
 const decryptedResults: Array<{ note: Note; score: number }> = []
 for (const { note, score } of topResults) {
 try {
 const content = await decrypt(note.content)
 const contentPlaintext = await decrypt(note.contentPlaintext)
 decryptedResults.push({
 note: {
 id: note.id,
 title: note.title,
 content, // Decrypted TipTap JSON
 contentPlaintext, // Decrypted plain text
 category: note.category,
 embedding: note.embedding,
 createdAt: note.createdAt,
 updatedAt: note.updatedAt,
 sourceUrl: note.sourceUrl
 },
 score
 })
 console.log(` Note "${note.title}" (score: ${score.toFixed(4)})`)
 } catch (error) {
 console.error(`Error decrypting note ${note.id}:`, error)
 }
 }
 const decryptTime = performance.now() - decryptStartTime
 console.log(
 `⏱ [DB Vector Search] Decrypt top ${limit} notes: ${decryptTime.toFixed(2)}ms`
 )

 const totalTime = performance.now() - startTime
 console.log(` [DB Vector Search] TOTAL time: ${totalTime.toFixed(2)}ms`)

 return decryptedResults
 } catch (error) {
 const totalTime = performance.now() - startTime
 console.error(
 ` [DB Vector Search] Failed after ${totalTime.toFixed(2)}ms:`,
 error
 )
 return []
 }
}

/**
 * Search notes semantically and return with full decrypted content
 * This is specifically for AI search where we need all content to summarize
 *
 * @param vector - The query embedding vector
 * @param limit - Maximum number of results to return
 * @returns Array of notes with decrypted content and combined text for summarization
 */
export async function searchNotesSemanticWithContent(
 vector: number[],
 limit: number = 5
): Promise<{ notes: Note[]; combinedContent: string }> {
 const startTime = performance.now()

 try {
 const searchStartTime = performance.now()
 const matchingNotes = await searchNotesByVector(vector, limit)
 const searchTime = performance.now() - searchStartTime
 console.log(
 `⏱ [Semantic Search With Content] Vector search: ${searchTime.toFixed(2)}ms`
 )

 if (matchingNotes.length === 0) {
 console.log(` [Semantic Search With Content] No matching notes found`)
 return { notes: [], combinedContent: "" }
 }

 const combineStartTime = performance.now()
 const combinedContent = matchingNotes
 .map((result, idx) => {
 // Use plain text content for AI summarization (not TipTap JSON)
 return `Note ${idx + 1}: ${result.note.title}\n${result.note.contentPlaintext}\n---`
 })
 .join("\n\n")
 const combineTime = performance.now() - combineStartTime
 console.log(
 `⏱ [Semantic Search With Content] Combine content: ${combineTime.toFixed(2)}ms (${combinedContent.length} chars)`
 )

 const totalTime = performance.now() - startTime
 console.log(
 `⏱ [Semantic Search With Content] TOTAL time: ${totalTime.toFixed(2)}ms`
 )

 return {
 notes: matchingNotes.map((result) => result.note),
 combinedContent
 }
 } catch (error) {
 const totalTime = performance.now() - startTime
 console.error(
 ` [Semantic Search With Content] Failed after ${totalTime.toFixed(2)}ms:`,
 error
 )
 return { notes: [], combinedContent: "" }
 }
}

/**
 * Search notes by title (OPTIMIZED: uses indexed prefix search)
 *
 * This function uses a hybrid approach:
 * 1. For title search: Uses the indexed 'title' field for fast prefix matching
 * 2. For content search: Falls back to full scan (can't avoid since content is encrypted)
 *
 * Note: Since content is encrypted, we can't search it without decryption.
 * For best performance, prefer searching by title when possible.
 */
export async function searchNotesByTitle(query: string): Promise<Note[]> {
 try {
 if (!query || query.trim() === "") {
 return []
 }

 const lowerQuery = query.toLowerCase()
 const results = new Map<string, Note>() // Use Map to avoid duplicates

 // OPTIMIZATION 1: Search by title using the index (fast!)
 // This uses case-insensitive prefix matching on the indexed title field
 const titleMatches = await db.notes
 .where("title")
 .startsWithIgnoreCase(query)
 .toArray()

 // Also check for title substring matches (not as fast, but covers more cases)
 const titleSubstringMatches = await db.notes
 .filter((note) => note.title.toLowerCase().includes(lowerQuery))
 .toArray()

 // Combine and decrypt title matches
 const allTitleMatches = [...titleMatches, ...titleSubstringMatches]
 const uniqueTitleMatches = Array.from(
 new Map(allTitleMatches.map((note) => [note.id, note])).values()
 )

 for (const storedNote of uniqueTitleMatches) {
 try {
 const content = await decrypt(storedNote.content)
 const contentPlaintext = await decrypt(storedNote.contentPlaintext)
 results.set(storedNote.id, {
 id: storedNote.id,
 title: storedNote.title,
 content,
 contentPlaintext,
 category: storedNote.category,
 embedding: storedNote.embedding,
 createdAt: storedNote.createdAt,
 updatedAt: storedNote.updatedAt,
 sourceUrl: storedNote.sourceUrl
 })
 } catch (error) {
 console.error(`Error decrypting note ${storedNote.id}:`, error)
 }
 }

 // OPTIMIZATION 2: For content search, we need to decrypt
 // Only do this if the title search didn't find many results
 if (results.size < 10) {
 // Get notes not already found by title search
 const remainingNotes = await db.notes
 .filter((note) => !results.has(note.id))
 .toArray()

 for (const storedNote of remainingNotes) {
 try {
 // Search in plaintext content
 const contentPlaintext = await decrypt(storedNote.contentPlaintext)
 if (contentPlaintext.toLowerCase().includes(lowerQuery)) {
 const content = await decrypt(storedNote.content)
 results.set(storedNote.id, {
 id: storedNote.id,
 title: storedNote.title,
 content,
 contentPlaintext,
 category: storedNote.category,
 embedding: storedNote.embedding,
 createdAt: storedNote.createdAt,
 updatedAt: storedNote.updatedAt,
 sourceUrl: storedNote.sourceUrl
 })
 }
 } catch (error) {
 console.error(`Error decrypting note ${storedNote.id}:`, error)
 }
 }
 }

 return Array.from(results.values())
 } catch (error) {
 console.error("Error searching notes by title:", error)
 return []
 }
}

/**
 * Get notes by category (optimized with Dexie's indexed query)
 */
export async function getNotesByCategory(category: string): Promise<Note[]> {
 try {
 // Use Dexie's indexed query for efficient filtering
 const storedNotes = await db.notes
 .where("category")
 .equals(category)
 .toArray()

 // Decrypt only the filtered results
 const notes: Note[] = []
 for (const storedNote of storedNotes) {
 try {
 const content = await decrypt(storedNote.content)
 const contentPlaintext = await decrypt(storedNote.contentPlaintext)
 notes.push({
 id: storedNote.id,
 title: storedNote.title,
 content,
 contentPlaintext,
 category: storedNote.category,
 embedding: storedNote.embedding,
 createdAt: storedNote.createdAt,
 updatedAt: storedNote.updatedAt,
 sourceUrl: storedNote.sourceUrl
 })
 } catch (error) {
 console.error(`Error decrypting note ${storedNote.id}:`, error)
 }
 }

 return notes
 } catch (error) {
 console.error("Error getting notes by category:", error)
 return []
 }
}

/**
 * Get all unique categories (OPTIMIZED: uses index, no decryption needed)
 *
 * This function is extremely fast because it reads ONLY from the category index
 * without touching any note objects or decrypting any content.
 */
export async function getAllCategories(): Promise<string[]> {
 try {
 // Use Dexie's uniqueKeys() to get unique categories from the index
 // This is orders of magnitude faster than loading all notes
 const categories = await db.notes.orderBy("category").uniqueKeys()
 return categories as string[]
 } catch (error) {
 console.error("Error getting categories:", error)
 return []
 }
}

/**
 * Get statistics about notes by category
 * Returns count of notes per category without decryption
 */
export async function getCategoryStatistics(): Promise<
 Array<{ category: string; count: number; lastUpdated: number }>
> {
 try {
 const categories = await getAllCategories()
 const stats = []

 for (const category of categories) {
 const notesInCategory = await db.notes
 .where("category")
 .equals(category)
 .toArray()

 const count = notesInCategory.length
 const lastUpdated =
 notesInCategory.length > 0
 ? Math.max(...notesInCategory.map((n) => n.updatedAt))
 : 0

 stats.push({ category, count, lastUpdated })
 }

 return stats
 } catch (error) {
 console.error("Error getting category statistics:", error)
 return []
 }
}

/**
 * Get comprehensive database statistics
 * Provides overview of all notes without decrypting content
 */
export async function getDatabaseStatistics(): Promise<{
 totalNotes: number
 categories: Array<{ category: string; count: number; lastUpdated: number }>
 oldestNoteDate: number | null
 newestNoteDate: number | null
 lastModifiedDate: number | null
}> {
 try {
 const allNotes = await db.notes.toArray()
 const totalNotes = allNotes.length

 const categoryStats = await getCategoryStatistics()

 const oldestNoteDate =
 allNotes.length > 0 ? Math.min(...allNotes.map((n) => n.createdAt)) : null
 const newestNoteDate =
 allNotes.length > 0 ? Math.max(...allNotes.map((n) => n.createdAt)) : null
 const lastModifiedDate =
 allNotes.length > 0 ? Math.max(...allNotes.map((n) => n.updatedAt)) : null

 return {
 totalNotes,
 categories: categoryStats,
 oldestNoteDate,
 newestNoteDate,
 lastModifiedDate
 }
 } catch (error) {
 console.error("Error getting database statistics:", error)
 return {
 totalNotes: 0,
 categories: [],
 oldestNoteDate: null,
 newestNoteDate: null,
 lastModifiedDate: null
 }
 }
}

/**
 * Create a new category
 */
export function createCategory(categoryName: string): string {
 const trimmed = categoryName.trim().toLowerCase()

 if (!trimmed) {
 throw new Error("Category name cannot be empty")
 }

 if (trimmed.length > 50) {
 throw new Error("Category name too long (max 50 characters)")
 }

 return trimmed
}

/**
 * Update category for multiple notes
 */
export async function updateCategory(
 oldCategory: string,
 newCategory: string
): Promise<number> {
 try {
 const notes = await getNotesByCategory(oldCategory)
 let updatedCount = 0

 for (const note of notes) {
 const updated = await updateNote(note.id, { category: newCategory })
 if (updated) {
 updatedCount++
 }
 }

 return updatedCount
 } catch (error) {
 console.error("Error updating category:", error)
 return 0
 }
}

/**
 * Delete a category and reassign notes
 */
export async function deleteCategory(
 category: string,
 reassignTo: string = "general"
): Promise<number> {
 try {
 const notes = await getNotesByCategory(category)
 let deletedCount = 0

 for (const note of notes) {
 const updated = await updateNote(note.id, { category: reassignTo })
 if (updated) {
 deletedCount++
 }
 }

 return deletedCount
 } catch (error) {
 console.error("Error deleting category:", error)
 return 0
 }
}

/**
 * Clear all notes
 */
export async function clearAllNotes(): Promise<void> {
 try {
 await db.notes.clear()
 console.log("All notes cleared")
 } catch (error) {
 console.error("Error clearing notes:", error)
 throw new Error("Failed to clear notes")
 }
}

/**
 * Debug function to verify IndexedDB connection and data
 */
export async function debugIndexedDB(): Promise<void> {
 console.log("=== IndexedDB Debug Info ===")

 try {
 // List all databases
 const databases = await indexedDB.databases()
 console.log("Available databases:", databases)

 // Check our database
 console.log("Connected to database:", db.name)
 console.log("Database version:", db.verno)
 console.log(
 "Tables:",
 db.tables.map((t) => t.name)
 )

 // Count notes
 const count = await db.notes.count()
 console.log(`Total notes in database: ${count}`)

 // Get all raw stored notes (encrypted)
 const rawNotes = await db.notes.toArray()
 console.log("Raw stored notes (encrypted):", rawNotes)

 console.log("=== End Debug Info ===")
 } catch (error) {
 console.error("Debug error:", error)
 }
}

// ============================================================================
// PERSONA MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID for a persona
 */
function generatePersonaId(): string {
 return `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Add a new persona to the database
 *
 * @param personaData - The persona data to save
 * @returns The created persona with generated ID and timestamps
 */
export async function addPersona(personaData: PersonaInput): Promise<Persona> {
 console.log(" [DB] addPersona called with:", personaData)

 const now = Date.now()
 const persona: Persona = {
 id: generatePersonaId(),
 name: personaData.name,
 description: personaData.description,
 context: personaData.context,
 emoji: personaData.emoji,
 outputTemplate: personaData.outputTemplate,
 isDefault: personaData.isDefault || false,
 isActive: false,
 createdAt: now,
 updatedAt: now
 }

 console.log(" [DB] Generated persona object:", persona)

 await db.personas.add(persona)
 console.log(" [DB] Persona added successfully with ID:", persona.id)

 return persona
}

/**
 * Get a persona by ID
 *
 * @param id - The persona ID
 * @returns The persona or undefined if not found
 */
export async function getPersona(id: string): Promise<Persona | undefined> {
 console.log(" [DB] getPersona called with ID:", id)

 const persona = await db.personas.get(id)

 if (persona) {
 console.log(" [DB] Persona found:", persona.name)
 } else {
 console.log(" [DB] Persona not found with ID:", id)
 }

 return persona
}

/**
 * Get all personas from the database
 *
 * @returns Array of all personas, sorted by name (deduplicated by ID)
 */
export async function getAllPersonas(): Promise<Persona[]> {
 console.log(" [DB] getAllPersonas called")

 const personas = await db.personas.orderBy("name").toArray()

 console.log(
 ` [DB] Retrieved ${personas.length} personas (before deduplication):`,
 personas.map((p) => ({ id: p.id, name: p.name }))
 )

 // Deduplicate by ID (in case there are duplicates in the database)
 const uniquePersonas = Array.from(
 new Map(personas.map((p) => [p.id, p])).values()
 )

 if (uniquePersonas.length < personas.length) {
 console.warn(
 ` [DB] Found ${personas.length - uniquePersonas.length} duplicate personas, removed them from results`
 )
 }

 console.log(` [DB] Returning ${uniquePersonas.length} unique personas`)

 return uniquePersonas
}

/**
 * Update an existing persona
 *
 * @param id - The persona ID to update
 * @param updates - Partial persona data to update
 * @returns The updated persona or undefined if not found
 */
export async function updatePersona(
 id: string,
 updates: Partial<PersonaInput>
): Promise<Persona | undefined> {
 console.log(
 " [DB] updatePersona called for ID:",
 id,
 "with updates:",
 updates
 )

 const existing = await db.personas.get(id)
 if (!existing) {
 console.log(" [DB] Persona not found for update:", id)
 return undefined
 }

 const updated: Persona = {
 ...existing,
 ...updates,
 updatedAt: Date.now()
 }

 await db.personas.update(id, updated)
 console.log(" [DB] Persona updated successfully:", updated.name)

 return updated
}

/**
 * Delete a persona from the database
 *
 * @param id - The persona ID to delete
 * @returns True if deleted, false if not found or is a default persona
 */
export async function deletePersona(id: string): Promise<boolean> {
 console.log(" [DB] deletePersona called for ID:", id)

 const persona = await db.personas.get(id)

 if (!persona) {
 console.log(" [DB] Persona not found for deletion:", id)
 return false
 }

 if (persona.isDefault) {
 console.log(" [DB] Cannot delete default persona:", persona.name)
 return false
 }

 await db.personas.delete(id)
 console.log(" [DB] Persona deleted successfully:", persona.name)

 return true
}

/**
 * Get all active personas
 *
 * @returns Array of active personas
 */
export async function getActivePersonas(): Promise<Persona[]> {
 console.log(" [DB] getActivePersonas called")

 const personas = await db.personas.where("isActive").equals(1).toArray()

 console.log(` [DB] Found ${personas.length} active personas`)

 return personas
}

/**
 * Set a persona as active (and deactivate all others)
 *
 * @param id - The persona ID to activate (null to deactivate all)
 * @returns True if successful
 */
export async function setActivePersona(id: string | null): Promise<boolean> {
 console.log(" [DB] setActivePersona called with ID:", id)

 try {
 // Deactivate all personas first
 const allPersonas = await db.personas.toArray()
 console.log(` [DB] Deactivating ${allPersonas.length} personas`)

 await Promise.all(
 allPersonas.map((p) => db.personas.update(p.id, { isActive: false }))
 )

 // Activate the specified persona if ID provided
 if (id) {
 const persona = await db.personas.get(id)
 if (!persona) {
 console.log(" [DB] Persona not found for activation:", id)
 return false
 }

 await db.personas.update(id, { isActive: true })
 console.log(" [DB] Activated persona:", persona.name)
 } else {
 console.log(" [DB] All personas deactivated (default mode)")
 }

 // Persist selection to chrome.storage for restoration on next load
 const { setSelectedPersona } = await import("./persona-settings")
 await setSelectedPersona(id)
 console.log(" [DB] Saved persona selection to chrome.storage")

 return true
 } catch (error) {
 console.error(" [DB] Error setting active persona:", error)
 return false
 }
}

/**
 * Get the currently active persona
 *
 * @returns The active persona or null if none active
 */
export async function getActivePersona(): Promise<Persona | null> {
 console.log(" [DB] getActivePersona called")

 const personas = await db.personas.where("isActive").equals(1).toArray()

 if (personas.length > 0) {
 console.log(" [DB] Active persona found:", personas[0].name)
 return personas[0]
 }

 console.log(" [DB] No active persona (default mode)")
 return null
}

/**
 * Clean up duplicate personas from the database
 * Keeps only the most recent version of each persona (by name)
 *
 * @returns Number of duplicate personas removed
 */
export async function cleanupDuplicatePersonas(): Promise<number> {
 console.log(" [DB] cleanupDuplicatePersonas called")

 try {
 const allPersonas = await db.personas.toArray()
 console.log(
 ` [DB] Found ${allPersonas.length} total personas in database`
 )

 // Group personas by name
 const personasByName = new Map<string, Persona[]>()
 for (const persona of allPersonas) {
 const existing = personasByName.get(persona.name) || []
 existing.push(persona)
 personasByName.set(persona.name, existing)
 }

 let removedCount = 0

 // For each group, keep only the most recent one
 for (const [name, personas] of personasByName.entries()) {
 if (personas.length > 1) {
 console.log(` [DB] Found ${personas.length} duplicates of "${name}"`)

 // Sort by updatedAt (newest first)
 personas.sort((a, b) => b.updatedAt - a.updatedAt)

 // Keep the first (newest), delete the rest
 const toKeep = personas[0]
 const toDelete = personas.slice(1)

 console.log(
 ` [DB] Keeping persona "${name}" with ID: ${toKeep.id} (updated: ${new Date(toKeep.updatedAt).toISOString()})`
 )

 for (const duplicate of toDelete) {
 await db.personas.delete(duplicate.id)
 removedCount++
 console.log(
 ` [DB] Deleted duplicate "${name}" with ID: ${duplicate.id}`
 )
 }
 }
 }

 console.log(
 ` [DB] Cleanup complete. Removed ${removedCount} duplicate personas`
 )
 return removedCount
 } catch (error) {
 console.error(" [DB] Error during cleanup:", error)
 return 0
 }
}
