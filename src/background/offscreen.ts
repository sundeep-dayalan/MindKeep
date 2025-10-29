import * as dbService from "~services/db-service"
import { logger } from "~utils/logger"

logger.log(" [Offscreen] Offscreen document initialized")

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.log(" [Offscreen] Received message:", message.type)

  const handleAsync = async () => {
    try {
      switch (message.type) {
        case "DB_SEARCH_BY_VECTOR": {
          const { vector, limit } = message.payload
          logger.log(` [Offscreen] Searching by vector (limit: ${limit})`)
          const results = await dbService.searchNotesByVector(vector, limit)
          logger.log(` [Offscreen] Found ${results.length} results`)
          sendResponse({ success: true, data: results })
          break
        }

        case "DB_SEARCH_BY_TITLE": {
          const { query } = message.payload
          logger.log(` [Offscreen] Searching by title: "${query}"`)
          const results = await dbService.searchNotesByTitle(query)
          logger.log(` [Offscreen] Found ${results.length} results`)
          sendResponse({ success: true, data: results })
          break
        }

        case "DB_GET_NOTE": {
          const { id } = message.payload
          logger.log(` [Offscreen] Getting note: ${id}`)
          const note = await dbService.getNote(id)
          sendResponse({ success: true, data: note })
          break
        }

        case "DB_GET_ALL_NOTES": {
          logger.log(" [Offscreen] Getting all notes")
          const notes = await dbService.getAllNotes()
          logger.log(` [Offscreen] Retrieved ${notes.length} notes`)
          sendResponse({ success: true, data: notes })
          break
        }

        case "DB_ADD_NOTE": {
          const { note } = message.payload
          logger.log(` [Offscreen] Adding note: ${note.title}`)
          const id = await dbService.addNote(note)
          sendResponse({ success: true, data: id })
          break
        }

        case "DB_UPDATE_NOTE": {
          const { note } = message.payload
          logger.log(` [Offscreen] Updating note: ${note.id}`)
          const { id, ...updates } = note
          await dbService.updateNote(id, updates)
          sendResponse({ success: true })
          break
        }

        case "DB_DELETE_NOTE": {
          const { id } = message.payload
          logger.log(` [Offscreen] Deleting note: ${id}`)
          await dbService.deleteNote(id)
          sendResponse({ success: true })
          break
        }

        case "DB_GET_ALL_CATEGORIES": {
          logger.log(" [Offscreen] Getting all categories")
          const categories = await dbService.getAllCategories()
          sendResponse({ success: true, data: categories })
          break
        }

        case "DB_GET_STATISTICS": {
          logger.log(" [Offscreen] Getting database statistics")
          const stats = await dbService.getDatabaseStatistics()
          logger.log(
            ` [Offscreen] Stats: ${stats.totalNotes} notes, ${stats.categories.length} categories`
          )
          sendResponse({ success: true, data: stats })
          break
        }

        case "DB_GET_PERSONA": {
          const { id } = message.payload
          logger.log(` [Offscreen] Getting persona: ${id}`)
          const persona = await dbService.getPersona(id)
          sendResponse({ success: true, data: persona })
          break
        }

        case "DB_GET_ALL_PERSONAS": {
          logger.log(" [Offscreen] Getting all personas")
          const personas = await dbService.getAllPersonas()
          sendResponse({ success: true, data: personas })
          break
        }

        case "DB_GET_ACTIVE_PERSONA": {
          logger.log(" [Offscreen] Getting active persona")
          const persona = await dbService.getActivePersona()
          sendResponse({ success: true, data: persona })
          break
        }

        case "DB_ADD_PERSONA": {
          const { persona } = message.payload
          logger.log(` [Offscreen] Adding persona: ${persona.name}`)
          const id = await dbService.addPersona(persona)
          sendResponse({ success: true, data: id })
          break
        }

        case "DB_UPDATE_PERSONA": {
          const { persona } = message.payload
          logger.log(` [Offscreen] Updating persona: ${persona.id}`)
          const { id, ...updates } = persona
          await dbService.updatePersona(id, updates)
          sendResponse({ success: true })
          break
        }

        case "DB_DELETE_PERSONA": {
          const { id } = message.payload
          logger.log(` [Offscreen] Deleting persona: ${id}`)
          await dbService.deletePersona(id)
          sendResponse({ success: true })
          break
        }

        case "DB_SET_ACTIVE_PERSONA": {
          const { id } = message.payload
          logger.log(` [Offscreen] Setting active persona: ${id}`)
          await dbService.setActivePersona(id)
          sendResponse({ success: true })
          break
        }

        default:
          logger.warn(` [Offscreen] Unknown message type: ${message.type}`)
          sendResponse({ success: false, error: "Unknown message type" })
      }
    } catch (error) {
      logger.error(` [Offscreen] Error handling ${message.type}:`, error)
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  handleAsync()

  return true
})

logger.log(" [Offscreen] Message listener registered")
