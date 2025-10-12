/**
 * Database service for MindKeep
 * Manages all database interactions using IndexedDB for storage
 * Integrates with crypto.ts for encryption/decryption
 */

import { encrypt, decrypt } from "~util/crypto"

// Note interface
export interface Note {
  id: string
  title: string
  content: string
  category: string
  embedding?: number[]
  createdAt: number
  updatedAt: number
  sourceUrl?: string
}

// Internal storage format (with encrypted content)
interface StoredNote {
  id: string
  title: string
  encryptedContent: string
  category: string
  embedding?: number[]
  createdAt: number
  updatedAt: number
  sourceUrl?: string
}

// IndexedDB database name
const DB_NAME = "mindkeep_db"
const DB_VERSION = 1
const STORE_NAME = "notes"

let dbInstance: IDBDatabase | null = null

/**
 * Initialize IndexedDB
 */
async function initializeDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
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
 */
export async function addNote(noteData: {
  title: string
  content: string
  category?: string
  sourceUrl?: string
  embedding?: number[]
}): Promise<Note> {
  try {
    const db = await initializeDB()
    const id = generateId()
    const encryptedContent = await encrypt(noteData.content)
    const now = Date.now()

    const storedNote: StoredNote = {
      id,
      title: noteData.title,
      encryptedContent,
      category: noteData.category || "general",
      embedding: noteData.embedding,
      createdAt: now,
      updatedAt: now,
      sourceUrl: noteData.sourceUrl
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.add(storedNote)

      request.onsuccess = () => {
        resolve({
          id,
          title: noteData.title,
          content: noteData.content,
          category: storedNote.category,
          embedding: noteData.embedding,
          createdAt: now,
          updatedAt: now,
          sourceUrl: noteData.sourceUrl
        })
      }

      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error("Error adding note:", error)
    throw new Error("Failed to add note")
  }
}

/**
 * Get a single note by ID
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
          const content = await decrypt(storedNote.encryptedContent)
          resolve({
            id: storedNote.id,
            title: storedNote.title,
            content,
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
 */
export async function updateNote(
  id: string,
  updates: {
    title?: string
    content?: string
    category?: string
    embedding?: number[]
  }
): Promise<Note | null> {
  try {
    const db = await initializeDB()
    const existingNote = await getNote(id)

    if (!existingNote) {
      return null
    }

    const encryptedContent =
      updates.content !== undefined
        ? await encrypt(updates.content)
        : (await new Promise<string>((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readonly")
            const store = transaction.objectStore(STORE_NAME)
            const request = store.get(id)

            request.onsuccess = () => {
              const storedNote = request.result as StoredNote
              resolve(storedNote.encryptedContent)
            }
            request.onerror = () => reject(request.error)
          }))

    const updatedNote: StoredNote = {
      id,
      title: updates.title ?? existingNote.title,
      encryptedContent,
      category: updates.category ?? existingNote.category,
      embedding: updates.embedding ?? existingNote.embedding,
      createdAt: existingNote.createdAt,
      updatedAt: Date.now(),
      sourceUrl: existingNote.sourceUrl
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(updatedNote)

      request.onsuccess = async () => {
        const content =
          updates.content !== undefined
            ? updates.content
            : await decrypt(updatedNote.encryptedContent)

        resolve({
          id: updatedNote.id,
          title: updatedNote.title,
          content,
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
 * Get all notes
 */
export async function getAllNotes(): Promise<Note[]> {
  try {
    const db = await initializeDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = async () => {
        const storedNotes = request.result as StoredNote[]
        const notes: Note[] = []

        for (const storedNote of storedNotes) {
          try {
            const content = await decrypt(storedNote.encryptedContent)
            notes.push({
              id: storedNote.id,
              title: storedNote.title,
              content,
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
        resolve(notes)
      }

      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error("Error getting all notes:", error)
    return []
  }
}

/**
 * Search notes by vector similarity
 */
export async function searchNotesByVector(
  vector: number[],
  limit: number = 5
): Promise<Note[]> {
  try {
    const allNotes = await getAllNotes()
    const notesWithEmbeddings = allNotes.filter((note) => note.embedding)

    if (notesWithEmbeddings.length === 0) {
      return []
    }

    const scored = notesWithEmbeddings.map((note) => ({
      note,
      score: cosineSimilarity(vector, note.embedding!)
    }))

    scored.sort((a, b) => b.score - a.score)

    return scored.slice(0, limit).map((item) => item.note)
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
