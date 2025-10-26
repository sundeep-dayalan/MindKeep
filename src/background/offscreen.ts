/**
 * Offscreen Document Script for MindKeep
 *
 * This script runs in an offscreen document context which provides:
 * 1. Access to the extension's IndexedDB (shared with side panel)
 * 2. Ability to respond to messages from content scripts
 * 3. Long-lived context for database operations
 *
 * Purpose: Bridge the gap between content scripts (which have isolated IndexedDB)
 * and the extension's shared IndexedDB containing all notes.
 */

import { generateEmbedding } from "~services/ai-service"
import * as dbService from "~services/db-service"

console.log("🟢 [Offscreen] Offscreen document initialized")

/**
 * Message handler for database operations
 * Routes requests from content scripts to the appropriate db-service functions
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 [Offscreen] Received message:", message.type)

  // All async operations need to return true to keep the message channel open
  const handleAsync = async () => {
    try {
      switch (message.type) {
        // ==================== SEARCH OPERATIONS ====================

        case "DB_SEARCH_BY_VECTOR": {
          const { vector, limit } = message.payload
          console.log(`🔍 [Offscreen] Searching by vector (limit: ${limit})`)
          const results = await dbService.searchNotesByVector(vector, limit)
          console.log(`✅ [Offscreen] Found ${results.length} results`)
          sendResponse({ success: true, data: results })
          break
        }

        case "DB_SEARCH_BY_TITLE": {
          const { query } = message.payload
          console.log(`🔍 [Offscreen] Searching by title: "${query}"`)
          const results = await dbService.searchNotesByTitle(query)
          console.log(`✅ [Offscreen] Found ${results.length} results`)
          sendResponse({ success: true, data: results })
          break
        }

        // ==================== NOTE OPERATIONS ====================

        case "DB_GET_NOTE": {
          const { id } = message.payload
          console.log(`📄 [Offscreen] Getting note: ${id}`)
          const note = await dbService.getNote(id)
          sendResponse({ success: true, data: note })
          break
        }

        case "DB_GET_ALL_NOTES": {
          console.log("📚 [Offscreen] Getting all notes")
          const notes = await dbService.getAllNotes()
          console.log(`✅ [Offscreen] Retrieved ${notes.length} notes`)
          sendResponse({ success: true, data: notes })
          break
        }

        case "DB_ADD_NOTE": {
          const { note } = message.payload
          console.log(`➕ [Offscreen] Adding note: ${note.title}`)
          const id = await dbService.addNote(note)
          sendResponse({ success: true, data: id })
          break
        }

        case "DB_UPDATE_NOTE": {
          const { note } = message.payload
          console.log(`🔄 [Offscreen] Updating note: ${note.id}`)
          await dbService.updateNote(note)
          sendResponse({ success: true })
          break
        }

        case "DB_DELETE_NOTE": {
          const { id } = message.payload
          console.log(`🗑️  [Offscreen] Deleting note: ${id}`)
          await dbService.deleteNote(id)
          sendResponse({ success: true })
          break
        }

        // ==================== CATEGORY OPERATIONS ====================

        case "DB_GET_ALL_CATEGORIES": {
          console.log("🏷️  [Offscreen] Getting all categories")
          const categories = await dbService.getAllCategories()
          sendResponse({ success: true, data: categories })
          break
        }

        // ==================== STATISTICS OPERATIONS ====================

        case "DB_GET_STATISTICS": {
          console.log("📊 [Offscreen] Getting database statistics")
          const stats = await dbService.getDatabaseStatistics()
          console.log(
            `✅ [Offscreen] Stats: ${stats.totalNotes} notes, ${stats.categories.length} categories`
          )
          sendResponse({ success: true, data: stats })
          break
        }

        // ==================== PERSONA OPERATIONS ====================

        case "DB_GET_PERSONA": {
          const { id } = message.payload
          console.log(`👤 [Offscreen] Getting persona: ${id}`)
          const persona = await dbService.getPersona(id)
          sendResponse({ success: true, data: persona })
          break
        }

        case "DB_GET_ALL_PERSONAS": {
          console.log("👥 [Offscreen] Getting all personas")
          const personas = await dbService.getAllPersonas()
          sendResponse({ success: true, data: personas })
          break
        }

        case "DB_GET_ACTIVE_PERSONA": {
          console.log("👤 [Offscreen] Getting active persona")
          const persona = await dbService.getActivePersona()
          sendResponse({ success: true, data: persona })
          break
        }

        case "DB_ADD_PERSONA": {
          const { persona } = message.payload
          console.log(`➕ [Offscreen] Adding persona: ${persona.name}`)
          const id = await dbService.addPersona(persona)
          sendResponse({ success: true, data: id })
          break
        }

        case "DB_UPDATE_PERSONA": {
          const { persona } = message.payload
          console.log(`🔄 [Offscreen] Updating persona: ${persona.id}`)
          await dbService.updatePersona(persona)
          sendResponse({ success: true })
          break
        }

        case "DB_DELETE_PERSONA": {
          const { id } = message.payload
          console.log(`🗑️  [Offscreen] Deleting persona: ${id}`)
          await dbService.deletePersona(id)
          sendResponse({ success: true })
          break
        }

        case "DB_SET_ACTIVE_PERSONA": {
          const { id } = message.payload
          console.log(`✅ [Offscreen] Setting active persona: ${id}`)
          await dbService.setActivePersona(id)
          sendResponse({ success: true })
          break
        }

        // ==================== AI OPERATIONS ====================

        case "AI_GENERATE_EMBEDDING": {
          const { text } = message.payload
          console.log(
            `🤖 [Offscreen] Generating embedding for text (${text.length} chars)`
          )
          const embedding = await generateEmbedding(text)
          console.log(
            `✅ [Offscreen] Generated embedding (${embedding.length} dimensions)`
          )
          sendResponse({ success: true, data: embedding })
          break
        }

        default:
          console.warn(`⚠️  [Offscreen] Unknown message type: ${message.type}`)
          sendResponse({ success: false, error: "Unknown message type" })
      }
    } catch (error) {
      console.error(`❌ [Offscreen] Error handling ${message.type}:`, error)
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  // Execute async handler
  handleAsync()

  // Return true to indicate we'll respond asynchronously
  return true
})

console.log("✅ [Offscreen] Message listener registered")
