import type { Note, Persona } from "~services/db-service"
import * as dbService from "~services/db-service"
import { logger } from "~utils/logger"

function isContentScript(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      !window.location.protocol.startsWith("chrome-extension:")
    )
  } catch {
    return false
  }
}

async function sendToOffscreen<T>(type: string, payload: any = {}): Promise<T> {
  try {
    const response = await chrome.runtime.sendMessage({
      type,
      payload
    })

    if (!response.success) {
      throw new Error(response.error || "Operation failed")
    }

    return response.data
  } catch (error) {
    logger.error(`[DB Proxy] Error sending message ${type}:`, error)
    throw error
  }
}

export async function searchNotesByVector(
  vector: number[],
  limit: number = 5
): Promise<Array<{ note: Note; score: number }>> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing searchNotesByVector to offscreen")
    return await sendToOffscreen("DB_SEARCH_BY_VECTOR", { vector, limit })
  }
  return await dbService.searchNotesByVector(vector, limit)
}

export async function searchNotesByTitle(query: string): Promise<Note[]> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing searchNotesByTitle to offscreen")
    return await sendToOffscreen("DB_SEARCH_BY_TITLE", { query })
  }
  return await dbService.searchNotesByTitle(query)
}

export async function getNote(id: string): Promise<Note | undefined> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing getNote to offscreen")
    return await sendToOffscreen("DB_GET_NOTE", { id })
  }
  return await dbService.getNote(id)
}

export async function getAllNotes(): Promise<Note[]> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing getAllNotes to offscreen")
    return await sendToOffscreen("DB_GET_ALL_NOTES")
  }
  return await dbService.getAllNotes()
}

export async function addNote(
  note: Omit<Note, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing addNote to offscreen")
    return await sendToOffscreen("DB_ADD_NOTE", { note })
  }
  return await dbService.addNote(note)
}

export async function updateNote(
  id: string,
  updates: Partial<Omit<Note, "id" | "createdAt" | "updatedAt">>
): Promise<Note | undefined> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing updateNote to offscreen")
    return await sendToOffscreen("DB_UPDATE_NOTE", { note: { id, ...updates } })
  }
  return await dbService.updateNote(id, updates)
}

export async function deleteNote(id: string): Promise<void> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing deleteNote to offscreen")
    await sendToOffscreen("DB_DELETE_NOTE", { id })
    return
  }
  return await dbService.deleteNote(id)
}

export async function getAllCategories(): Promise<string[]> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing getAllCategories to offscreen")
    return await sendToOffscreen("DB_GET_ALL_CATEGORIES")
  }
  return await dbService.getAllCategories()
}

export async function getDatabaseStatistics(): Promise<{
  totalNotes: number
  categories: Array<{ category: string; count: number; lastUpdated: number }>
  oldestNoteDate: number | null
  newestNoteDate: number | null
  lastModifiedDate: number | null
}> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing getDatabaseStatistics to offscreen")
    return await sendToOffscreen("DB_GET_STATISTICS")
  }
  return await dbService.getDatabaseStatistics()
}

export async function getPersona(id: string): Promise<Persona | undefined> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing getPersona to offscreen")
    return await sendToOffscreen("DB_GET_PERSONA", { id })
  }
  return await dbService.getPersona(id)
}

export async function getAllPersonas(): Promise<Persona[]> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing getAllPersonas to offscreen")
    return await sendToOffscreen("DB_GET_ALL_PERSONAS")
  }
  return await dbService.getAllPersonas()
}

export async function getActivePersona(): Promise<Persona | null> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing getActivePersona to offscreen")
    return await sendToOffscreen("DB_GET_ACTIVE_PERSONA")
  }
  return await dbService.getActivePersona()
}

export async function addPersona(
  persona: Omit<Persona, "id">
): Promise<string> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing addPersona to offscreen")
    return await sendToOffscreen("DB_ADD_PERSONA", { persona })
  }
  return await dbService.addPersona(persona)
}

export async function updatePersona(persona: Persona): Promise<void> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing updatePersona to offscreen")
    await sendToOffscreen("DB_UPDATE_PERSONA", { persona })
    return
  }
  return await dbService.updatePersona(persona)
}

export async function deletePersona(id: string): Promise<void> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing deletePersona to offscreen")
    await sendToOffscreen("DB_DELETE_PERSONA", { id })
    return
  }
  return await dbService.deletePersona(id)
}

export async function setActivePersona(id: string | null): Promise<boolean> {
  if (isContentScript()) {
    logger.log(" [DB Proxy] Routing setActivePersona to offscreen")
    await sendToOffscreen("DB_SET_ACTIVE_PERSONA", { id })
    return true
  }
  return await dbService.setActivePersona(id)
}

export type { Note, Persona }
