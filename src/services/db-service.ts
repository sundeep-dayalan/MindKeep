/**
 * Database service for MindKeep
 * Manages all database interactions using IndexedDB for storage
 *
 * CRITICAL: This service stores and retrieves data AS-IS.
 * It does NOT generate embeddings - that is done by ai-service.ts in the background script
 * It does NOT encrypt/decrypt - that is done by crypto.ts in the background script
 *
 * The background script orchestrates the full pipeline:
 * SAVE: Receive data → Generate embedding → Encrypt content → Store here
 * RETRIEVE: Fetch from here → Decrypt content → Return to UI
 */

import { decrypt } from "~util/crypto"

// Note interface (decrypted, user-facing format)
export interface Note {
  id: string
  title: string
  content: string // Plaintext content (for display)
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
  content: string // ENCRYPTED content (base64 string) - stored as "content" in DB
  category: string // Plaintext for filtering
  embedding?: number[] // Plaintext vector for semantic search
  createdAt: number
  updatedAt: number
  sourceUrl?: string
}

// IndexedDB database name
const DB_NAME = "mindkeep_db"
const DB_VERSION = 1
const STORE_NAME = "notes"

let dbInstance: IDBDatabase | null = null
let migrationRun = false

/**
 * Initialize IndexedDB
 */
async function initializeDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance
  }

  return new Promise(async (resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = async () => {
      dbInstance = request.result

      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: "id" })
        objectStore.createIndex("category", "category", { unique: false })
        objectStore.createIndex("updatedAt", "updatedAt", { unique: false })
      }
    }
  })
}

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
 * - content should be ENCRYPTED (base64 string from crypto.encrypt())
 * - embedding should be GENERATED (number array from ai-service.generateEmbedding())
 *
 * This function ONLY stores the data as provided.
 *
 * @param noteData - Pre-processed note data with encrypted content and generated embedding
 * @returns The stored note metadata (with encrypted content)
 */
export async function addNote(noteData: {
  title: string
  content: string // ENCRYPTED content (base64 string)
  category?: string
  sourceUrl?: string
  embedding?: number[] // Pre-generated embedding vector
}): Promise<StoredNote> {
  try {
    const db = await initializeDB()
    const id = generateId()
    const now = Date.now()

    const storedNote: StoredNote = {
      id,
      title: noteData.title,
      content: noteData.content, // Store encrypted content as-is
      category: noteData.category || "general",
      embedding: noteData.embedding, // Store embedding as-is
      createdAt: now,
      updatedAt: now,
      sourceUrl: noteData.sourceUrl
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.add(storedNote)

      request.onsuccess = () => {
        resolve(storedNote)
      }

      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error("Error adding note:", error)
    throw new Error("Failed to add note")
  }
}

/**
 * Get a single note by ID and decrypt its content
 *
 * IMPORTANT: This function retrieves the stored note and decrypts the content
 * before returning it. The decryption happens here for convenience, but the
 * background script could also handle this if preferred.
 *
 * @param id - The unique ID of the note
 * @returns The note with decrypted content, or null if not found
 */
export async function getNote(id: string): Promise<Note | null> {
  try {
    const db = await initializeDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = async () => {
        const storedNote = request.result as StoredNote | undefined

        if (!storedNote) {
          resolve(null)
          return
        }

        try {
          // Decrypt the content field
          const content = await decrypt(storedNote.content)
          resolve({
            id: storedNote.id,
            title: storedNote.title,
            content, // Decrypted content
            category: storedNote.category,
            embedding: storedNote.embedding,
            createdAt: storedNote.createdAt,
            updatedAt: storedNote.updatedAt,
            sourceUrl: storedNote.sourceUrl
          })
        } catch (error) {
          console.error("Error decrypting note:", error)
          resolve(null)
        }
      }

      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error("Error getting note:", error)
    return null
  }
}

/**
 * Update an existing note
 *
 * IMPORTANT: If content is provided in updates, it should be PRE-ENCRYPTED.
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
    content?: string // If provided, should be ENCRYPTED
    category?: string
    embedding?: number[] // If provided, should be pre-generated
  }
): Promise<Note | null> {
  try {
    const db = await initializeDB()

    // Get existing stored note (with encrypted content)
    const existingStoredNote = await new Promise<StoredNote | null>(
      (resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly")
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(id)

        request.onsuccess = () => {
          resolve(request.result || null)
        }
        request.onerror = () => reject(request.error)
      }
    )

    if (!existingStoredNote) {
      return null
    }

    const updatedNote: StoredNote = {
      id,
      title: updates.title ?? existingStoredNote.title,
      content: updates.content ?? existingStoredNote.content, // Use encrypted content as-is
      category: updates.category ?? existingStoredNote.category,
      embedding: updates.embedding ?? existingStoredNote.embedding,
      createdAt: existingStoredNote.createdAt,
      updatedAt: Date.now(),
      sourceUrl: existingStoredNote.sourceUrl
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(updatedNote)

      request.onsuccess = async () => {
        // Decrypt content for return value
        const content = await decrypt(updatedNote.content)

        resolve({
          id: updatedNote.id,
          title: updatedNote.title,
          content, // Decrypted content
          category: updatedNote.category,
          embedding: updatedNote.embedding,
          createdAt: updatedNote.createdAt,
          updatedAt: updatedNote.updatedAt,
          sourceUrl: updatedNote.sourceUrl
        })
      }

      request.onerror = () => reject(request.error)
    })
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
    const db = await initializeDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => resolve(true)
      request.onerror = () => reject(request.error)
    })
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
    const db = await initializeDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(request.result as StoredNote[])
      }

      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error("Error getting stored notes:", error)
    return []
  }
}

/**
 * Get all notes and decrypt their content
 *
 * IMPORTANT: This function retrieves all stored notes and decrypts each
 * content field before returning. Used by the Side Panel to display notes.
 *
 * @returns Array of notes with decrypted content, sorted by updatedAt (newest first)
 */
export async function getAllNotes(): Promise<Note[]> {
  try {
    const storedNotes = await getAllStoredNotes()
    const notes: Note[] = []

    for (const storedNote of storedNotes) {
      try {
        // Decrypt the content field
        const content = await decrypt(storedNote.content)
        notes.push({
          id: storedNote.id,
          title: storedNote.title,
          content, // Decrypted content
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
 * Search notes by vector similarity
 *
 * IMPORTANT: This function performs semantic search using pre-generated embeddings.
 * The query embedding should be generated by the background script before calling this.
 * Only decrypts the content of matching notes (for efficiency).
 *
 * @param vector - The query embedding vector (from ai-service.generateEmbedding)
 * @param limit - Maximum number of results to return
 * @returns Array of notes with decrypted content, sorted by similarity score
 */
export async function searchNotesByVector(
  vector: number[],
  limit: number = 5
): Promise<Note[]> {
  try {
    // Get stored notes (with encrypted content)
    const storedNotes = await getAllStoredNotes()
    const notesWithEmbeddings = storedNotes.filter((note) => note.embedding)

    if (notesWithEmbeddings.length === 0) {
      return []
    }

    // Calculate similarity scores
    const scored = notesWithEmbeddings.map((note) => ({
      note,
      score: cosineSimilarity(vector, note.embedding!)
    }))

    // Sort by score and take top results
    scored.sort((a, b) => b.score - a.score)
    const topResults = scored.slice(0, limit)

    // Decrypt only the top matching notes
    const decryptedNotes: Note[] = []
    for (const { note } of topResults) {
      try {
        const content = await decrypt(note.content)
        decryptedNotes.push({
          id: note.id,
          title: note.title,
          content, // Decrypted content
          category: note.category,
          embedding: note.embedding,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          sourceUrl: note.sourceUrl
        })
      } catch (error) {
        console.error(`Error decrypting note ${note.id}:`, error)
      }
    }

    return decryptedNotes
  } catch (error) {
    console.error("Error searching notes by vector:", error)
    return []
  }
}

/**
 * Search notes by title
 */
export async function searchNotesByTitle(query: string): Promise<Note[]> {
  try {
    const allNotes = await getAllNotes()
    const lowerQuery = query.toLowerCase()

    return allNotes.filter(
      (note) =>
        note.title.toLowerCase().includes(lowerQuery) ||
        note.content.toLowerCase().includes(lowerQuery)
    )
  } catch (error) {
    console.error("Error searching notes by title:", error)
    return []
  }
}

/**
 * Get notes by category
 */
export async function getNotesByCategory(category: string): Promise<Note[]> {
  try {
    const allNotes = await getAllNotes()
    return allNotes.filter((note) => note.category === category)
  } catch (error) {
    console.error("Error getting notes by category:", error)
    return []
  }
}

/**
 * Get all unique categories
 */
export async function getAllCategories(): Promise<string[]> {
  try {
    const allNotes = await getAllNotes()
    const categories = new Set<string>()

    allNotes.forEach((note) => {
      if (note.category) {
        categories.add(note.category)
      }
    })

    return Array.from(categories).sort()
  } catch (error) {
    console.error("Error getting categories:", error)
    return []
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
    const db = await initializeDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        console.log("All notes cleared")
        resolve()
      }

      request.onerror = () => reject(request.error)
    })
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
    const db = await initializeDB()
    console.log("Connected to database:", DB_NAME)
    console.log("Object stores:", Array.from(db.objectStoreNames))

    // Count notes
    const count = await new Promise<number>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    console.log(`Total notes in database: ${count}`)

    // Get all raw stored notes (encrypted)
    const rawNotes = await new Promise<StoredNote[]>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    console.log("Raw stored notes (encrypted):", rawNotes)

    console.log("=== End Debug Info ===")
  } catch (error) {
    console.error("Debug error:", error)
  }
}
