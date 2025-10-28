import { generateEmbedding } from "~services/ai-service"
import * as dbService from "~services/db-service"
import {
  addNote,
  getActivePersona,
  getAllPersonas,
  getPersona,
  setActivePersona,
  updateNote
} from "~services/db-service"
import { getGlobalAgent } from "~services/langchain-agent"
import { encrypt } from "~util/crypto"

export {}

const sidePanelState = new Map<number, boolean>()

let creatingOffscreen: Promise<void> | null = null

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType]
  })

  if (existingContexts.length > 0) {
    console.log("🟢 [Background] Offscreen document already exists")
    return
  }

  if (creatingOffscreen) {
    console.log("⏳ [Background] Waiting for offscreen document creation...")
    await creatingOffscreen
    return
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: "offscreen/offscreen.html",
    reasons: ["DOM_SCRAPING" as chrome.offscreen.Reason],
    justification:
      "Provide shared IndexedDB access for database operations across extension contexts"
  })

  console.log("🔄 [Background] Creating offscreen document...")

  await creatingOffscreen
  creatingOffscreen = null

  console.log("✅ [Background] Offscreen document created successfully")
}

chrome.runtime.onStartup.addListener(async () => {
  console.log(
    "🚀 [Background] Extension startup - initializing offscreen document"
  )
  await ensureOffscreenDocument()
})

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return

  const tabId = tab.id
  const isOpen = sidePanelState.get(tabId) || false

  if (isOpen) {
    chrome.runtime.sendMessage({ type: "CLOSE_SIDE_PANEL" })
    sidePanelState.set(tabId, false)
  } else {
    await chrome.sidePanel.open({ tabId: tabId })
    sidePanelState.set(tabId, true)
  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  sidePanelState.delete(tabId)
})

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "SIDE_PANEL_OPENED" && sender.tab?.id) {
    sidePanelState.set(sender.tab.id, true)
  }
})

chrome.runtime.onInstalled.addListener(async () => {
  console.log("📦 [Background] Extension installed/updated")

  chrome.contextMenus.create({
    id: "saveToMindKeep",
    title: "Save to MindKeep",
    contexts: ["selection"]
  })

  await ensureOffscreenDocument()
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "saveToMindKeep" && info.selectionText && tab?.id) {
    await chrome.sidePanel.open({ tabId: tab.id })

    let content = info.selectionText
    let isHtml = false

    try {
      const response = await chrome.tabs.sendMessage(
        tab.id,
        { type: "GET_SELECTED_HTML" },
        { frameId: 0 }
      )

      if (response?.html) {
        content = response.html
        isHtml = true
      }
    } catch (error) {
      console.warn(
        "Could not get HTML from content script:",
        error.message,
        "- Using plain text fallback"
      )
    }

    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: "FILL_EDITOR",
        data: {
          content: content,
          isHtml: isHtml,
          sourceUrl: tab.url
        }
      })
    }, 500)
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(` [Background Listener] Received message type: ${message.type}`, {
    saveId: message.data?._debugSaveId || "N/A",
    timestamp: Date.now()
  })
  ;(async () => {
    try {
      switch (message.type) {
        case "DB_SEARCH_BY_VECTOR": {
          const { vector, limit } = message.payload
          console.log(`🔍 [Offscreen] Searching by vector (limit: ${limit})`)
          const results = await dbService.searchNotesByVector(vector, limit)
          console.log(`✅ [Offscreen] Found ${results.length} results`)
          return { success: true, data: results }
        }

        case "DB_SEARCH_BY_TITLE": {
          const { query } = message.payload
          console.log(`🔍 [Offscreen] Searching by title: "${query}"`)
          const results = await dbService.searchNotesByTitle(query)
          console.log(`✅ [Offscreen] Found ${results.length} results`)
          return { success: true, data: results }
        }

        case "DB_GET_NOTE": {
          const { id } = message.payload
          console.log(`📄 [Offscreen] Getting note: ${id}`)
          const note = await dbService.getNote(id)
          return { success: true, data: note }
        }

        case "DB_GET_ALL_NOTES": {
          console.log("📚 [Offscreen] Getting all notes")
          const notes = await dbService.getAllNotes()
          console.log(`✅ [Offscreen] Retrieved ${notes.length} notes`)
          return { success: true, data: notes }
        }

        case "DB_ADD_NOTE": {
          const { note } = message.payload
          console.log(`➕ [Offscreen] Adding note: ${note.title}`)
          const id = await dbService.addNote(note)
          return { success: true, data: id }
        }

        case "DB_UPDATE_NOTE": {
          const { note } = message.payload
          console.log(`🔄 [Offscreen] Updating note: ${note.id}`)
          const { id, ...updates } = note
          await dbService.updateNote(id, updates)
          return { success: true }
        }

        case "DB_DELETE_NOTE": {
          const { id } = message.payload
          console.log(`🗑️  [Offscreen] Deleting note: ${id}`)
          await dbService.deleteNote(id)
          return { success: true }
        }

        case "DB_GET_ALL_CATEGORIES": {
          console.log("🏷️  [Offscreen] Getting all categories")
          const categories = await dbService.getAllCategories()
          return { success: true, data: categories }
        }

        case "DB_GET_PERSONA": {
          const { id } = message.payload
          console.log(`👤 [Offscreen] Getting persona: ${id}`)
          const persona = await dbService.getPersona(id)
          return { success: true, data: persona }
        }

        case "DB_GET_ALL_PERSONAS": {
          console.log("👥 [Offscreen] Getting all personas")
          const personas = await dbService.getAllPersonas()
          return { success: true, data: personas }
        }

        case "DB_GET_ACTIVE_PERSONA": {
          console.log("👤 [Offscreen] Getting active persona")
          const persona = await dbService.getActivePersona()
          return { success: true, data: persona }
        }

        case "DB_ADD_PERSONA": {
          const { persona } = message.payload
          console.log(`➕ [Offscreen] Adding persona: ${persona.name}`)
          const id = await dbService.addPersona(persona)
          return { success: true, data: id }
        }

        case "DB_UPDATE_PERSONA": {
          const { persona } = message.payload
          console.log(`🔄 [Offscreen] Updating persona: ${persona.id}`)
          const { id, ...updates } = persona
          await dbService.updatePersona(id, updates)
          return { success: true }
        }

        case "DB_DELETE_PERSONA": {
          const { id } = message.payload
          console.log(`🗑️  [Offscreen] Deleting persona: ${id}`)
          await dbService.deletePersona(id)
          return { success: true }
        }

        case "DB_SET_ACTIVE_PERSONA": {
          const { id } = message.payload
          console.log(`✅ [Offscreen] Setting active persona: ${id}`)
          await dbService.setActivePersona(id)
          return { success: true }
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
          return { success: true, data: embedding }
        }

        case "SAVE_NOTE":
          return await handleSaveNote(message.data)

        case "UPDATE_NOTE":
          return await handleUpdateNote(message.data)

        case "GET_ALL_PERSONAS":
          console.log(" [Background] GET_ALL_PERSONAS request received")
          const personas = await getAllPersonas()
          console.log(` [Background] Returning ${personas.length} personas`)
          return { success: true, personas }

        case "GET_ACTIVE_PERSONA":
          console.log(" [Background] GET_ACTIVE_PERSONA request received")
          const activePersona = await getActivePersona()
          console.log(
            " [Background] Active persona:",
            activePersona?.name || "None"
          )
          return { success: true, persona: activePersona }

        case "SET_ACTIVE_PERSONA":
          console.log(
            " [Background] SET_ACTIVE_PERSONA request received for ID:",
            message.data?.personaId
          )
          try {
            if (message.data?.personaId) {
              console.log(
                " [Background] Checking if persona exists:",
                message.data.personaId
              )
              const persona = await getPersona(message.data.personaId)
              if (!persona) {
                console.error(
                  " [Background] Persona not found for ID:",
                  message.data.personaId
                )
                return { success: false, error: "Persona not found" }
              }
              console.log(" [Background] Persona found:", persona.name)
            }

            console.log(" [Background] Calling setActivePersona...")
            const success = await setActivePersona(
              message.data?.personaId || null
            )

            if (!success) {
              console.error(" [Background] setActivePersona returned false")
              return {
                success: false,
                error: "Failed to set active persona in database"
              }
            }

            console.log(" [Background] Database updated successfully")

            console.log(" [Background] Updating global agent...")
            const agent = await getGlobalAgent()

            const persona = message.data?.personaId
              ? await getPersona(message.data.personaId)
              : null

            await agent.setPersona(persona || null)
            console.log(
              " [Background] Persona updated successfully:",
              persona?.name || "Default"
            )

            return { success: true, persona: persona || null }
          } catch (error) {
            console.error(" [Background] Error in SET_ACTIVE_PERSONA:", error)
            console.error(" [Background] Error stack:", error?.stack)
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }
          }

        case "SESSION_STORAGE_SAVE":
          console.log(
            " [Background] SESSION_STORAGE_SAVE request received",
            message.data?.messages?.length || 0,
            "messages"
          )
          try {
            await chrome.storage.session.set({
              ai_chat_messages: message.data.messages,
              ai_chat_metadata: {
                lastUpdated: Date.now(),
                messageCount: message.data.messages.length
              }
            })
            return { success: true }
          } catch (error) {
            console.error(" [Background] SESSION_STORAGE_SAVE error:", error)
            return { success: false, error: String(error) }
          }

        case "SESSION_STORAGE_LOAD":
          console.log(" [Background] SESSION_STORAGE_LOAD request received")
          try {
            const result = await chrome.storage.session.get("ai_chat_messages")
            const messages = result.ai_chat_messages || []
            console.log(
              " [Background] Loaded",
              messages.length,
              "messages from session storage"
            )
            return { success: true, messages }
          } catch (error) {
            console.error(" [Background] SESSION_STORAGE_LOAD error:", error)
            return { success: false, messages: [], error: String(error) }
          }

        case "SESSION_STORAGE_CLEAR":
          console.log(" [Background] SESSION_STORAGE_CLEAR request received")
          try {
            await chrome.storage.session.remove([
              "ai_chat_messages",
              "ai_chat_metadata"
            ])
            return { success: true }
          } catch (error) {
            console.error(" [Background] SESSION_STORAGE_CLEAR error:", error)
            return { success: false, error: String(error) }
          }

        case "SESSION_STORAGE_GET_METADATA":
          console.log(
            " [Background] SESSION_STORAGE_GET_METADATA request received"
          )
          try {
            const result = await chrome.storage.session.get("ai_chat_metadata")
            const metadata = result.ai_chat_metadata || null
            return { success: true, metadata }
          } catch (error) {
            console.error(
              " [Background] SESSION_STORAGE_GET_METADATA error:",
              error
            )
            return { success: false, metadata: null, error: String(error) }
          }

        default:
          return { success: false, error: "Unknown message type" }
      }
    } catch (error) {
      console.error("Error handling message:", error)
      return { success: false, error: String(error) }
    }
  })().then(sendResponse)

  return true
})

async function handleSaveNote(data: {
  title: string
  category?: string
  content: string
  contentPlaintext: string
  sourceUrl?: string
  embedding?: number[]
}): Promise<{ success: boolean; note?: any; error?: string }> {
  const startTime = performance.now()
  const saveId = `save-${Date.now()}-${Math.random().toString(36).substring(7)}`

  try {
    console.log(`[${saveId}] [BG Save] Starting save pipeline...`, {
      title: data.title,
      hasEmbedding: !!data.embedding
    })

    const { title, category, content, contentPlaintext, sourceUrl, embedding } =
      data

    let embeddingVector: number[]
    if (embedding && embedding.length > 0) {
      console.log(
        `[${saveId}] [BG Save] Using pre-generated embedding: ${embedding.length} dimensions`
      )
      embeddingVector = embedding
    } else {
      const embeddingStartTime = performance.now()
      console.log(" [BG Save] Generating embedding from plaintext content...")
      embeddingVector = await generateEmbedding(contentPlaintext)
      const embeddingTime = performance.now() - embeddingStartTime
      console.log(
        `⏱ [BG Save] Embedding generation: ${embeddingTime.toFixed(2)}ms (${embeddingVector.length} dimensions)`
      )
    }

    const encryptStartTime = performance.now()
    const encryptedContent = await encrypt(content)
    const encryptedPlaintext = await encrypt(contentPlaintext)
    const encryptTime = performance.now() - encryptStartTime
    console.log(` [BG Save] Content encryption: ${encryptTime.toFixed(2)}ms`)

    const noteObject = {
      title,
      category: category || "general",
      content: encryptedContent,
      contentPlaintext: encryptedPlaintext,
      embedding: embeddingVector,
      sourceUrl
    }

    const dbStartTime = performance.now()
    const savedNote = await addNote(noteObject)
    const dbTime = performance.now() - dbStartTime
    console.log(
      `[${saveId}] ⏱ [BG Save] Database storage: ${dbTime.toFixed(2)}ms`
    )

    const totalTime = performance.now() - startTime
    console.log(
      `[${saveId}] ⏱ [BG Save] TOTAL background save time: ${totalTime.toFixed(2)}ms`
    )
    console.log(
      `[${saveId}] [BG Save] Breakdown: Encrypt=${encryptTime.toFixed(2)}ms, DB=${dbTime.toFixed(2)}ms`
    )

    return {
      success: true,
      note: savedNote
    }
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.error(
      ` [BG Save] Save pipeline failed after ${totalTime.toFixed(2)}ms:`,
      error
    )
    return {
      success: false,
      error: String(error)
    }
  }
}

async function handleUpdateNote(data: {
  id: string
  title?: string
  category?: string
  content?: string
  contentPlaintext?: string
  embedding?: number[]
}): Promise<{ success: boolean; note?: any; error?: string }> {
  const startTime = performance.now()

  try {
    console.log(" [BG Update] Starting update pipeline for note:", data.id)

    const { id, title, category, content, contentPlaintext, embedding } = data
    const updates: any = {}

    if (title !== undefined) updates.title = title
    if (category !== undefined) updates.category = category

    if (content !== undefined && contentPlaintext !== undefined) {
      let embeddingVector: number[]
      if (embedding && embedding.length > 0) {
        console.log(
          ` [BG Update] Using pre-generated embedding: ${embedding.length} dimensions`
        )
        embeddingVector = embedding
      } else {
        const embeddingStartTime = performance.now()
        console.log(
          " [BG Update] Generating new embedding from plaintext content..."
        )
        embeddingVector = await generateEmbedding(contentPlaintext)
        const embeddingTime = performance.now() - embeddingStartTime
        console.log(
          `⏱ [BG Update] Embedding generation: ${embeddingTime.toFixed(2)}ms (${embeddingVector.length} dimensions)`
        )
      }

      const encryptStartTime = performance.now()
      const encryptedContent = await encrypt(content)
      const encryptedPlaintext = await encrypt(contentPlaintext)
      const encryptTime = performance.now() - encryptStartTime
      console.log(
        `⏱ [BG Update] Content encryption: ${encryptTime.toFixed(2)}ms`
      )

      updates.content = encryptedContent
      updates.contentPlaintext = encryptedPlaintext
      updates.embedding = embeddingVector
    }

    const dbStartTime = performance.now()
    const updatedNote = await updateNote(id, updates)
    const dbTime = performance.now() - dbStartTime
    console.log(` [BG Update] Database update: ${dbTime.toFixed(2)}ms`)

    if (!updatedNote) {
      throw new Error("Note not found")
    }

    const totalTime = performance.now() - startTime
    console.log(
      `⏱ [BG Update] TOTAL background update time: ${totalTime.toFixed(2)}ms`
    )

    return {
      success: true,
      note: updatedNote
    }
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.error(
      ` [BG Update] Update pipeline failed after ${totalTime.toFixed(2)}ms:`,
      error
    )
    return {
      success: false,
      error: String(error)
    }
  }
}

console.log(" MindKeep background script loaded")
