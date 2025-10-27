/**
 * Database Proxy Service
 *
 * This service provides a unified interface for database operations that works
 * across different Chrome extension contexts:
 *
 * - Extension Pages (side panel, popup, etc.): Direct access to IndexedDB
 * - Content Scripts: Proxies requests to offscreen document via message passing
 *
 * The proxy automatically detects the current context and routes requests appropriately.
 */

import type { Note, Persona } from "~services/db-service"
import * as dbService from "~services/db-service"

/**
 * Detect if we're running in a content script context
 */
function isContentScript(): boolean {
  // Content scripts don't have access to chrome.runtime.getContexts
  // and window.location.protocol will be the webpage's protocol (http/https)
  // Extension pages will have chrome-extension:// protocol
  try {
    return (
      typeof window !== "undefined" &&
      !window.location.protocol.startsWith("chrome-extension:")
    )
  } catch {
    return false
  }
}

/**
 * Send a message to the offscreen document and wait for response
 */
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
    console.error(`[DB Proxy] Error sending message ${type}:`, error)
    throw error
  }
}

// ==================== SEARCH OPERATIONS ====================

/**
 * Search notes by vector similarity
 */
export async function searchNotesByVector(
  vector: number[],
  limit: number = 5
): Promise<Array<{ note: Note; score: number }>> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing searchNotesByVector to offscreen")
    return await sendToOffscreen("DB_SEARCH_BY_VECTOR", { vector, limit })
  }
  return await dbService.searchNotesByVector(vector, limit)
}

/**
 * Search notes by title
 */
export async function searchNotesByTitle(query: string): Promise<Note[]> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing searchNotesByTitle to offscreen")
    return await sendToOffscreen("DB_SEARCH_BY_TITLE", { query })
  }
  return await dbService.searchNotesByTitle(query)
}

// ==================== NOTE OPERATIONS ====================

/**
 * Get a specific note by ID
 */
export async function getNote(id: string): Promise<Note | undefined> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing getNote to offscreen")
    return await sendToOffscreen("DB_GET_NOTE", { id })
  }
  return await dbService.getNote(id)
}

/**
 * Get all notes
 */
export async function getAllNotes(): Promise<Note[]> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing getAllNotes to offscreen")
    return await sendToOffscreen("DB_GET_ALL_NOTES")
  }
  return await dbService.getAllNotes()
}

/**
 * Add a new note
 */
export async function addNote(
  note: Omit<Note, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing addNote to offscreen")
    return await sendToOffscreen("DB_ADD_NOTE", { note })
  }
  return await dbService.addNote(note)
}

/**
 * Update an existing note
 */
export async function updateNote(
  id: string,
  updates: Partial<Omit<Note, "id" | "createdAt" | "updatedAt">>
): Promise<Note | undefined> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing updateNote to offscreen")
    return await sendToOffscreen("DB_UPDATE_NOTE", { note: { id, ...updates } })
  }
  return await dbService.updateNote(id, updates)
}

/**
 * Delete a note
 */
export async function deleteNote(id: string): Promise<void> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing deleteNote to offscreen")
    await sendToOffscreen("DB_DELETE_NOTE", { id })
    return
  }
  return await dbService.deleteNote(id)
}

// ==================== CATEGORY OPERATIONS ====================

/**
 * Get all unique categories
 */
export async function getAllCategories(): Promise<string[]> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing getAllCategories to offscreen")
    return await sendToOffscreen("DB_GET_ALL_CATEGORIES")
  }
  return await dbService.getAllCategories()
}

// ==================== STATISTICS OPERATIONS ====================

/**
 * Get database statistics
 */
export async function getDatabaseStatistics(): Promise<{
  totalNotes: number
  categories: Array<{ category: string; count: number; lastUpdated: number }>
  oldestNoteDate: number | null
  newestNoteDate: number | null
  lastModifiedDate: number | null
}> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing getDatabaseStatistics to offscreen")
    return await sendToOffscreen("DB_GET_STATISTICS")
  }
  return await dbService.getDatabaseStatistics()
}

// ==================== PERSONA OPERATIONS ====================

/**
 * Get a specific persona by ID
 */
export async function getPersona(id: string): Promise<Persona | undefined> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing getPersona to offscreen")
    return await sendToOffscreen("DB_GET_PERSONA", { id })
  }
  return await dbService.getPersona(id)
}

/**
 * Get all personas
 */
export async function getAllPersonas(): Promise<Persona[]> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing getAllPersonas to offscreen")
    return await sendToOffscreen("DB_GET_ALL_PERSONAS")
  }
  return await dbService.getAllPersonas()
}

/**
 * Get the currently active persona
 */
export async function getActivePersona(): Promise<Persona | null> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing getActivePersona to offscreen")
    return await sendToOffscreen("DB_GET_ACTIVE_PERSONA")
  }
  return await dbService.getActivePersona()
}

/**
 * Add a new persona
 */
export async function addPersona(
  persona: Omit<Persona, "id">
): Promise<string> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing addPersona to offscreen")
    return await sendToOffscreen("DB_ADD_PERSONA", { persona })
  }
  return await dbService.addPersona(persona)
}

/**
 * Update an existing persona
 */
export async function updatePersona(persona: Persona): Promise<void> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing updatePersona to offscreen")
    await sendToOffscreen("DB_UPDATE_PERSONA", { persona })
    return
  }
  return await dbService.updatePersona(persona)
}

/**
 * Delete a persona
 */
export async function deletePersona(id: string): Promise<void> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing deletePersona to offscreen")
    await sendToOffscreen("DB_DELETE_PERSONA", { id })
    return
  }
  return await dbService.deletePersona(id)
}

/**
 * Set the active persona
 */
export async function setActivePersona(id: string | null): Promise<boolean> {
  if (isContentScript()) {
    console.log("📡 [DB Proxy] Routing setActivePersona to offscreen")
    await sendToOffscreen("DB_SET_ACTIVE_PERSONA", { id })
    return true
  }
  return await dbService.setActivePersona(id)
}

// Export type from db-service for convenience
export type { Note, Persona }
