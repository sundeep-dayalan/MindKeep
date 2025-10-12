/**
 * Database service for MindKeep
 * Manages all database interactions using ChromaDB for vector storage
 * Integrates with crypto.ts for encryption/decryption
 */

import type { Collection } from "chromadb"
import { ChromaClient } from "chromadb"

import { decrypt, encrypt } from "~util/crypto"

// Note interface
export interface Note {
  id: string
  title: string
  content: string // Stored encrypted
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
  createdAt: number
  updatedAt: number
  sourceUrl?: string
}

// ChromaDB collection name
const COLLECTION_NAME = "mindkeep_notes"

// Initialize ChromaDB client
let chromaClient: ChromaClient | null = null
let notesCollection: Collection | null = null

/**
 * Initialize the ChromaDB client and collection
 */
async function initializeDB(): Promise<Collection> {
  if (notesCollection) {
    return notesCollection
  }

  try {
    // Initialize ChromaDB client
    chromaClient = new ChromaClient()

    // Get or create the notes collection
    try {
      notesCollection = await chromaClient.getOrCreateCollection({
        name: COLLECTION_NAME,
        metadata: { description: "MindKeep notes with embeddings" }
      })
    } catch (error) {
      console.error("Error getting collection:", error)
      // Fallback: try to create collection
      notesCollection = await chromaClient.createCollection({
        name: COLLECTION_NAME,
        metadata: { description: "MindKeep notes with embeddings" }
      })
    }

    console.log("ChromaDB initialized successfully")
    return notesCollection
  } catch (error) {
    console.error("Failed to initialize ChromaDB:", error)
    throw new Error("Database initialization failed")
  }
}

/**
 * Generate a unique ID for a note
 */
function generateId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Store note metadata in Chrome storage
 */
async function storeNoteMetadata(note: StoredNote): Promise<void> {
  const storageKey = `note_${note.id}`
  await chrome.storage.local.set({ [storageKey]: note })
}

/**
 * Get note metadata from Chrome storage
 */
async function getNoteMetadata(id: string): Promise<StoredNote | null> {
  const storageKey = `note_${id}`
  const result = await chrome.storage.local.get(storageKey)
  return result[storageKey] || null
}

/**
 * Get all note metadata from Chrome storage
 */
async function getAllNoteMetadata(): Promise<StoredNote[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (result) => {
      const notes: StoredNote[] = []

      for (const key in result) {
        if (key.startsWith("note_note_")) {
          notes.push(result[key])
        }
      }

      resolve(notes)
    })
  })
}

/**
 * Delete note metadata from Chrome storage
 */
async function deleteNoteMetadata(id: string): Promise<void> {
  const storageKey = `note_${id}`
  await chrome.storage.local.remove(storageKey)
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
    const collection = await initializeDB()

    // Generate ID and encrypt content
    const id = generateId()
    const encryptedContent = await encrypt(noteData.content)
    const now = Date.now()

    // Create stored note
    const storedNote: StoredNote = {
      id,
      title: noteData.title,
      encryptedContent,
      category: noteData.category || "general",
      createdAt: now,
      updatedAt: now,
      sourceUrl: noteData.sourceUrl
    }

    // Store metadata in Chrome storage
    await storeNoteMetadata(storedNote)

    // If embedding is provided, add to ChromaDB
    if (noteData.embedding && noteData.embedding.length > 0) {
      await collection.add({
        ids: [id],
        embeddings: [noteData.embedding],
        metadatas: [
          {
            title: noteData.title,
            category: storedNote.category,
            createdAt: now.toString(),
            sourceUrl: noteData.sourceUrl || ""
          }
        ],
        documents: [noteData.title] // Use title as document for search
      })
    }

    // Return decrypted note
    return {
      id,
      title: noteData.title,
      content: noteData.content,
      category: storedNote.category,
      embedding: noteData.embedding,
      createdAt: now,
      updatedAt: now,
      sourceUrl: noteData.sourceUrl
    }
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
    const storedNote = await getNoteMetadata(id)

    if (!storedNote) {
      return null
    }

    // Decrypt content
    const content = await decrypt(storedNote.encryptedContent)

    return {
      id: storedNote.id,
      title: storedNote.title,
      content,
      category: storedNote.category,
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
    const storedNote = await getNoteMetadata(id)

    if (!storedNote) {
      return null
    }

    const collection = await initializeDB()

    // Update fields
    if (updates.title !== undefined) {
      storedNote.title = updates.title
    }

    if (updates.content !== undefined) {
      storedNote.encryptedContent = await encrypt(updates.content)
    }

    if (updates.category !== undefined) {
      storedNote.category = updates.category
    }

    storedNote.updatedAt = Date.now()

    // Update metadata in Chrome storage
    await storeNoteMetadata(storedNote)

    // Update ChromaDB if embedding is provided
    if (updates.embedding && updates.embedding.length > 0) {
      try {
        // Check if exists in ChromaDB
        await collection.update({
          ids: [id],
          embeddings: [updates.embedding],
          metadatas: [
            {
              title: storedNote.title,
              category: storedNote.category,
              createdAt: storedNote.createdAt.toString(),
              sourceUrl: storedNote.sourceUrl || ""
            }
          ],
          documents: [storedNote.title]
        })
      } catch (error) {
        // If doesn't exist, add it
        await collection.add({
          ids: [id],
          embeddings: [updates.embedding],
          metadatas: [
            {
              title: storedNote.title,
              category: storedNote.category,
              createdAt: storedNote.createdAt.toString(),
              sourceUrl: storedNote.sourceUrl || ""
            }
          ],
          documents: [storedNote.title]
        })
      }
    }

    // Return decrypted note
    const content = await decrypt(storedNote.encryptedContent)
    return {
      id: storedNote.id,
      title: storedNote.title,
      content,
      category: storedNote.category,
      createdAt: storedNote.createdAt,
      updatedAt: storedNote.updatedAt,
      sourceUrl: storedNote.sourceUrl,
      embedding: updates.embedding
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
    const collection = await initializeDB()

    // Delete from ChromaDB
    try {
      await collection.delete({ ids: [id] })
    } catch (error) {
      console.log("Note not found in ChromaDB (may not have embedding)")
    }

    // Delete from Chrome storage
    await deleteNoteMetadata(id)

    return true
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
    const storedNotes = await getAllNoteMetadata()
    const notes: Note[] = []

    for (const storedNote of storedNotes) {
      try {
        const content = await decrypt(storedNote.encryptedContent)
        notes.push({
          id: storedNote.id,
          title: storedNote.title,
          content,
          category: storedNote.category,
          createdAt: storedNote.createdAt,
          updatedAt: storedNote.updatedAt,
          sourceUrl: storedNote.sourceUrl
        })
      } catch (error) {
        console.error(`Error decrypting note ${storedNote.id}:`, error)
      }
    }

    // Sort by updatedAt descending
    return notes.sort((a, b) => b.updatedAt - a.updatedAt)
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
    const collection = await initializeDB()

    // Query ChromaDB
    const results = await collection.query({
      queryEmbeddings: [vector],
      nResults: limit
    })

    if (!results.ids || !results.ids[0] || results.ids[0].length === 0) {
      return []
    }

    // Get full notes from storage
    const notes: Note[] = []
    for (const id of results.ids[0]) {
      const note = await getNote(id as string)
      if (note) {
        notes.push(note)
      }
    }

    return notes
  } catch (error) {
    console.error("Error searching notes by vector:", error)
    return []
  }
}

/**
 * Search notes by title (simple text search)
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
 * Clear all notes (use with caution!)
 */
export async function clearAllNotes(): Promise<void> {
  try {
    const collection = await initializeDB()

    // Delete collection from ChromaDB
    if (chromaClient) {
      await chromaClient.deleteCollection({ name: COLLECTION_NAME })
      notesCollection = null
    }

    // Clear all note metadata from Chrome storage
    const keysToRemove: string[] = await new Promise((resolve) => {
      chrome.storage.local.get(null, (allData) => {
        const keys: string[] = []

        for (const key in allData) {
          if (key.startsWith("note_")) {
            keys.push(key)
          }
        }

        resolve(keys)
      })
    })

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove)
    }

    console.log("All notes cleared")
  } catch (error) {
    console.error("Error clearing notes:", error)
    throw new Error("Failed to clear notes")
  }
}
