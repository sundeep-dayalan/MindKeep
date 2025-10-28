import Dexie, { type Table } from "dexie"

import { setSelectedPersona } from "~services/persona-settings"
import type { Persona, PersonaInput } from "~types/persona"
import { decrypt } from "~util/crypto"

export interface Note {
  id: string
  title: string
  content: string
  contentPlaintext: string
  category: string
  embedding?: number[]
  createdAt: number
  updatedAt: number
  sourceUrl?: string
}

export interface StoredNote {
  id: string
  title: string
  content: string
  contentPlaintext: string
  category: string
  embedding?: number[]
  createdAt: number
  updatedAt: number
  sourceUrl?: string
}

class MindKeepDatabase extends Dexie {
  notes!: Table<StoredNote, string>
  personas!: Table<Persona, string>

  constructor() {
    super("mindkeep_db")

    this.version(2).stores({
      notes: "id, category, updatedAt, createdAt, title"
    })

    this.version(3).stores({
      notes: "id, category, updatedAt, createdAt, title",
      personas: "id, name, createdAt, updatedAt, isActive, isDefault"
    })
  }
}

const db = new MindKeepDatabase()

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

function generateId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export async function addNote(noteData: {
  title: string
  content: string
  contentPlaintext: string
  category?: string
  sourceUrl?: string
  embedding?: number[]
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
      content: noteData.content,
      contentPlaintext: noteData.contentPlaintext,
      category: noteData.category || "general",
      embedding: noteData.embedding,
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

export async function getNote(id: string): Promise<Note | null> {
  try {
    const storedNote = await db.notes.get(id)

    if (!storedNote) {
      return null
    }

    const content = await decrypt(storedNote.content)
    const contentPlaintext = await decrypt(storedNote.contentPlaintext)

    return {
      id: storedNote.id,
      title: storedNote.title,
      content,
      contentPlaintext,
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

export async function updateNote(
  id: string,
  updates: {
    title?: string
    content?: string
    contentPlaintext?: string
    category?: string
    embedding?: number[]
  }
): Promise<Note | null> {
  try {
    const existingStoredNote = await db.notes.get(id)

    if (!existingStoredNote) {
      return null
    }

    const updatedNote: StoredNote = {
      id,
      title: updates.title ?? existingStoredNote.title,
      content: updates.content ?? existingStoredNote.content,
      contentPlaintext:
        updates.contentPlaintext ?? existingStoredNote.contentPlaintext,
      category: updates.category ?? existingStoredNote.category,
      embedding: updates.embedding ?? existingStoredNote.embedding,
      createdAt: existingStoredNote.createdAt,
      updatedAt: Date.now(),
      sourceUrl: existingStoredNote.sourceUrl
    }

    await db.notes.put(updatedNote)

    const content = await decrypt(updatedNote.content)
    const contentPlaintext = await decrypt(updatedNote.contentPlaintext)

    return {
      id: updatedNote.id,
      title: updatedNote.title,
      content,
      contentPlaintext,
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

export async function deleteNote(id: string): Promise<boolean> {
  try {
    await db.notes.delete(id)
    return true
  } catch (error) {
    console.error("Error deleting note:", error)
    return false
  }
}

async function getAllStoredNotes(): Promise<StoredNote[]> {
  try {
    return await db.notes.toArray()
  } catch (error) {
    console.error("Error getting stored notes:", error)
    return []
  }
}

export async function getAllNotes(): Promise<Note[]> {
  try {
    const storedNotes = await getAllStoredNotes()
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

    notes.sort((a, b) => b.updatedAt - a.updatedAt)
    return notes
  } catch (error) {
    console.error("Error getting all notes:", error)
    return []
  }
}

export async function searchNotesByVector(
  vector: number[],
  limit: number = 5
): Promise<Array<{ note: Note; score: number }>> {
  const startTime = performance.now()

  try {
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

    const scoreStartTime = performance.now()
    const scored = storedNotes.map((note) => ({
      note,
      score: cosineSimilarity(vector, note.embedding!)
    }))
    const scoreTime = performance.now() - scoreStartTime
    console.log(
      `⏱ [DB Vector Search] Calculate similarity scores: ${scoreTime.toFixed(2)}ms`
    )

    const sortStartTime = performance.now()
    scored.sort((a, b) => b.score - a.score)
    const topResults = scored.slice(0, limit)
    const sortTime = performance.now() - sortStartTime
    console.log(
      `⏱ [DB Vector Search] Sort and slice top ${limit} results: ${sortTime.toFixed(2)}ms`
    )

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
            content,
            contentPlaintext,
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

export async function searchNotesByTitle(query: string): Promise<Note[]> {
  try {
    if (!query || query.trim() === "") {
      return []
    }

    const lowerQuery = query.toLowerCase()
    const results = new Map<string, Note>()

    const titleMatches = await db.notes
      .where("title")
      .startsWithIgnoreCase(query)
      .toArray()

    const titleSubstringMatches = await db.notes
      .filter((note) => note.title.toLowerCase().includes(lowerQuery))
      .toArray()

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

    if (results.size < 10) {
      const remainingNotes = await db.notes
        .filter((note) => !results.has(note.id))
        .toArray()

      for (const storedNote of remainingNotes) {
        try {
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

export async function getNotesByCategory(category: string): Promise<Note[]> {
  try {
    const storedNotes = await db.notes
      .where("category")
      .equals(category)
      .toArray()

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

export async function getAllCategories(): Promise<string[]> {
  try {
    const categories = await db.notes.orderBy("category").uniqueKeys()
    return categories as string[]
  } catch (error) {
    console.error("Error getting categories:", error)
    return []
  }
}

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

export async function clearAllNotes(): Promise<void> {
  try {
    await db.notes.clear()
    console.log("All notes cleared")
  } catch (error) {
    console.error("Error clearing notes:", error)
    throw new Error("Failed to clear notes")
  }
}

export async function debugIndexedDB(): Promise<void> {
  console.log("=== IndexedDB Debug Info ===")

  try {
    const databases = await indexedDB.databases()
    console.log("Available databases:", databases)

    console.log("Connected to database:", db.name)
    console.log("Database version:", db.verno)
    console.log(
      "Tables:",
      db.tables.map((t) => t.name)
    )

    const count = await db.notes.count()
    console.log(`Total notes in database: ${count}`)

    const rawNotes = await db.notes.toArray()
    console.log("Raw stored notes (encrypted):", rawNotes)

    console.log("=== End Debug Info ===")
  } catch (error) {
    console.error("Debug error:", error)
  }
}

function generatePersonaId(): string {
  return `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export async function addPersona(personaData: PersonaInput): Promise<Persona> {
  console.log(" [DB] addPersona called with:", personaData)

  const now = Date.now()
  const persona: Persona = {
    id: generatePersonaId(),
    name: personaData.name,
    description: personaData.description,
    context: personaData.context,
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

export async function getAllPersonas(): Promise<Persona[]> {
  console.log(" [DB] getAllPersonas called")

  const personas = await db.personas.orderBy("name").toArray()

  console.log(
    ` [DB] Retrieved ${personas.length} personas (before deduplication):`,
    personas.map((p) => ({ id: p.id, name: p.name }))
  )

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

export async function getActivePersonas(): Promise<Persona[]> {
  console.log(" [DB] getActivePersonas called")

  const personas = await db.personas.where("isActive").equals(1).toArray()

  console.log(` [DB] Found ${personas.length} active personas`)

  return personas
}

export async function setActivePersona(id: string | null): Promise<boolean> {
  console.log(" [DB] setActivePersona called with ID:", id)

  try {
    console.log(" [DB] Fetching all personas...")
    const allPersonas = await db.personas.toArray()
    console.log(` [DB] Found ${allPersonas.length} personas in database`)
    console.log(
      " [DB] Persona IDs:",
      allPersonas.map((p) => p.id)
    )

    console.log(" [DB] Deactivating all personas...")
    await Promise.all(
      allPersonas.map((p) => db.personas.update(p.id, { isActive: false }))
    )
    console.log(" [DB] All personas deactivated")

    if (id) {
      console.log(" [DB] Looking for persona with ID:", id)
      const persona = await db.personas.get(id)
      if (!persona) {
        console.error(" [DB] Persona not found for activation:", id)
        console.error(
          " [DB] Available persona IDs:",
          allPersonas.map((p) => p.id)
        )
        return false
      }

      console.log(" [DB] Found persona:", persona.name, "- Activating...")
      await db.personas.update(id, { isActive: true })
      console.log(" [DB] Activated persona:", persona.name)
    } else {
      console.log(" [DB] All personas deactivated (default mode)")
    }

    console.log(" [DB] Persisting selection to chrome.storage...")
    await setSelectedPersona(id)
    console.log(" [DB] Saved persona selection to chrome.storage")

    return true
  } catch (error) {
    console.error(" [DB] Error setting active persona:", error)
    console.error(" [DB] Error stack:", error?.stack)
    return false
  }
}

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

export async function cleanupDuplicatePersonas(): Promise<number> {
  console.log(" [DB] cleanupDuplicatePersonas called")

  try {
    const allPersonas = await db.personas.toArray()
    console.log(` [DB] Found ${allPersonas.length} total personas in database`)

    const personasByName = new Map<string, Persona[]>()
    for (const persona of allPersonas) {
      const existing = personasByName.get(persona.name) || []
      existing.push(persona)
      personasByName.set(persona.name, existing)
    }

    let removedCount = 0

    for (const [name, personas] of personasByName.entries()) {
      if (personas.length > 1) {
        console.log(` [DB] Found ${personas.length} duplicates of "${name}"`)

        personas.sort((a, b) => b.updatedAt - a.updatedAt)

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
