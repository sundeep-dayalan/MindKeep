

import { generateEmbedding } from "~services/ai-service"
import * as dbService from "~services/db-service"

console.log("🟢 [Offscreen] Dedicated offscreen document initialized")

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 [Offscreen] Received message:", message.type)

  ;(async () => {
    try {
      switch (message.type) {

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
          const { id, ...updates } = note
          await dbService.updateNote(id, updates)
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

        case "DB_GET_ALL_CATEGORIES": {
          console.log("🏷️  [Offscreen] Getting all categories")
          const categories = await dbService.getAllCategories()
          sendResponse({ success: true, data: categories })
          break
        }

        case "DB_GET_STATISTICS": {
          console.log("📊 [Offscreen] Getting database statistics")
          const stats = await dbService.getDatabaseStatistics()
          console.log(
            `✅ [Offscreen] Stats: ${stats.totalNotes} notes, ${stats.categories.length} categories`
          )
          sendResponse({ success: true, data: stats })
          break
        }

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
          const { id, ...updates } = persona
          await dbService.updatePersona(id, updates)
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
  })()

  return true
})

console.log("✅ [Offscreen] Message listener registered")
