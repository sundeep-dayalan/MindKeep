/**
 * Main background script for MindKeep
 *
 * CRITICAL RESPONSIBILITIES:
 * This script orchestrates the complete data processing pipeline:
 *
 * SAVE PIPELINE:
 * 1. Receive raw note data (title, category, plaintext content)
 * 2. Generate embedding from plaintext content (ai-service)
 * 3. Encrypt the plaintext content (crypto)
 * 4. Assemble final object with: title, category, encrypted content, embedding
 * 5. Store in database (db-service)
 *
 * RETRIEVE PIPELINE:
 * 1. Generate embedding from search query (ai-service)
 * 2. Search database by vector similarity (db-service)
 * 3. Database returns notes with encrypted content
 * 4. Decrypt content for each result (crypto)
 * 5. Return complete, readable notes to UI
 */

import { generateEmbedding, getIntent } from "~services/ai-service"
import { addNote, searchNotesByVector, updateNote } from "~services/db-service"
import { encrypt } from "~util/crypto"

export {}

// Track side panel state per tab
const sidePanelState = new Map<number, boolean>()

// ==================== SIDE PANEL & UI MANAGEMENT ====================

/**
 * Listen for extension icon click to toggle side panel
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return

  const tabId = tab.id
  const isOpen = sidePanelState.get(tabId) || false

  if (isOpen) {
    sidePanelState.set(tabId, false)
  } else {
    await chrome.sidePanel.open({ tabId: tabId })
    sidePanelState.set(tabId, true)
  }
})

/**
 * Clean up state when tab is closed
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  sidePanelState.delete(tabId)
})

// ==================== CONTEXT MENU ====================

/**
 * Create context menu item for saving selected text
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveToMindKeep",
    title: "Save to MindKeep",
    contexts: ["selection"]
  })
})

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "saveToMindKeep" && info.selectionText && tab?.id) {
    // Open side panel
    await chrome.sidePanel.open({ tabId: tab.id })

    // Send selected text to side panel
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: "FILL_EDITOR",
        data: {
          content: info.selectionText,
          sourceUrl: tab.url
        }
      })
    }, 500)
  }
})

// ==================== NOTE PROCESSING PIPELINE ====================

/**
 * Message handler for processing note operations
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle async operations properly
  ;(async () => {
    try {
      switch (message.type) {
        case "SAVE_NOTE":
          return await handleSaveNote(message.data)

        case "UPDATE_NOTE":
          return await handleUpdateNote(message.data)

        case "SEARCH_NOTES":
          return await handleSearchNotes(message.data)

        default:
          return { success: false, error: "Unknown message type" }
      }
    } catch (error) {
      console.error("Error handling message:", error)
      return { success: false, error: String(error) }
    }
  })().then(sendResponse)

  // Return true to indicate async response
  return true
})

/**
 * SAVE PIPELINE ORCHESTRATOR
 *
 * Steps:
 * 1. Receive raw note data (with optional pre-generated embedding)
 * 2. Generate embedding from PLAINTEXT content (if not provided)
 * 3. Encrypt the content
 * 4. Assemble final object
 * 5. Save to database
 */
async function handleSaveNote(data: {
  title: string
  category?: string
  content: string
  sourceUrl?: string
  embedding?: number[] // Optional pre-generated embedding from side panel
}): Promise<{ success: boolean; note?: any; error?: string }> {
  try {
    console.log("📝 Starting save pipeline...")

    // Step 1: Data Reception (already done via message)
    const { title, category, content, sourceUrl, embedding } = data

    // Step 2: Embedding Generation (from PLAINTEXT)
    // Use pre-generated embedding if provided, otherwise generate here
    let embeddingVector: number[]
    if (embedding && embedding.length > 0) {
      console.log(
        `✅ Using pre-generated embedding: ${embedding.length} dimensions`
      )
      embeddingVector = embedding
    } else {
      console.log("🔢 Generating embedding from plaintext content...")
      embeddingVector = await generateEmbedding(content)
      console.log(`✅ Embedding generated: ${embeddingVector.length} dimensions`)
    }

    // Step 3: Content Encryption
    console.log("🔒 Encrypting content...")
    const encryptedContent = await encrypt(content)
    console.log("✅ Content encrypted")

    // Step 4: Final Data Assembly
    const noteObject = {
      title,
      category: category || "general",
      content: encryptedContent, // ENCRYPTED
      embedding: embeddingVector, // PLAINTEXT vector
      sourceUrl
    }

    // Step 5: Database Storage
    console.log("💾 Saving to database...")
    const savedNote = await addNote(noteObject)
    console.log("✅ Note saved successfully:", savedNote.id)

    return {
      success: true,
      note: savedNote
    }
  } catch (error) {
    console.error("❌ Save pipeline failed:", error)
    return {
      success: false,
      error: String(error)
    }
  }
}

/**
 * UPDATE PIPELINE ORCHESTRATOR
 *
 * Steps:
 * 1. Receive note ID and update data (with optional pre-generated embedding)
 * 2. Generate new embedding if content changed (from PLAINTEXT, if not provided)
 * 3. Encrypt new content if changed
 * 4. Update in database
 */
async function handleUpdateNote(data: {
  id: string
  title?: string
  category?: string
  content?: string
  embedding?: number[] // Optional pre-generated embedding from side panel
}): Promise<{ success: boolean; note?: any; error?: string }> {
  try {
    console.log("✏️ Starting update pipeline for note:", data.id)

    const { id, title, category, content, embedding } = data
    const updates: any = {}

    // Update title/category if provided (no processing needed)
    if (title !== undefined) updates.title = title
    if (category !== undefined) updates.category = category

    // If content is being updated, process it through the pipeline
    if (content !== undefined) {
      // Use pre-generated embedding if provided, otherwise generate here
      let embeddingVector: number[]
      if (embedding && embedding.length > 0) {
        console.log(
          `✅ Using pre-generated embedding: ${embedding.length} dimensions`
        )
        embeddingVector = embedding
      } else {
        console.log("🔢 Generating new embedding from plaintext content...")
        embeddingVector = await generateEmbedding(content)
        console.log(
          `✅ Embedding generated: ${embeddingVector.length} dimensions`
        )
      }

      console.log("🔒 Encrypting new content...")
      const encryptedContent = await encrypt(content)
      console.log("✅ Content encrypted")

      updates.content = encryptedContent
      updates.embedding = embeddingVector
    }

    console.log("💾 Updating in database...")
    const updatedNote = await updateNote(id, updates)

    if (!updatedNote) {
      throw new Error("Note not found")
    }

    console.log("✅ Note updated successfully:", updatedNote.id)

    return {
      success: true,
      note: updatedNote
    }
  } catch (error) {
    console.error("❌ Update pipeline failed:", error)
    return {
      success: false,
      error: String(error)
    }
  }
}

/**
 * SEARCH PIPELINE ORCHESTRATOR
 *
 * Steps:
 * 1. Receive search query
 * 2. Classify intent (fill vs display)
 * 3. Generate embedding from query
 * 4. Search database by vector
 * 5. Database returns decrypted notes
 * 6. Return results
 */
async function handleSearchNotes(data: {
  query: string
  limit?: number
}): Promise<{
  success: boolean
  intent?: string
  results?: any[]
  error?: string
}> {
  try {
    console.log("🔍 Starting search pipeline...")

    const { query, limit = 5 } = data

    // Step 1: Intent Classification (parallel with embedding)
    console.log("🤔 Classifying intent...")
    const [intent, queryEmbedding] = await Promise.all([
      getIntent(query),
      generateEmbedding(query)
    ])
    console.log(`✅ Intent: ${intent}`)
    console.log(
      `✅ Query embedding generated: ${queryEmbedding.length} dimensions`
    )

    // Step 2: Vector Search
    console.log("🔍 Searching database...")
    const results = await searchNotesByVector(queryEmbedding, limit)
    console.log(`✅ Found ${results.length} results`)

    return {
      success: true,
      intent,
      results
    }
  } catch (error) {
    console.error("❌ Search pipeline failed:", error)
    return {
      success: false,
      error: String(error)
    }
  }
}

console.log("🧠 MindKeep background script loaded")
