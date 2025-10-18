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
 * 4. Run agent pipeline (multi-pass persona execution)
 * 5. Store final result in database (db-service)
 *
 * RETRIEVE PIPELINE:
 * 1. Generate embedding from search query (ai-service)
 * 2. Search database by vector similarity (db-service)
 * 3. Database returns notes with encrypted content
 * 4. Decrypt content for each result (crypto)
 * 5. Return complete, readable notes to UI
 */

import { generateEmbedding } from "~services/ai-service"
import { addNote, updateNote, addPersona, getAllPersonas } from "~services/db-service"
import { runAgentPipeline } from "~services/agent-pipeline"
import { DEFAULT_PERSONAS } from "~data/default-personas"
import { encrypt, decrypt } from "~util/crypto"
import type { Note } from "~services/db-service"

// TEST: Import LangGraph to measure actual bundle impact
import { testLangGraphBundle } from "~services/test-langgraph-bundle"

export {}

// FORCE LangGraph into bundle by calling it
testLangGraphBundle().catch(console.error);

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
    // Request side panel to close itself
    chrome.runtime.sendMessage({ type: "CLOSE_SIDE_PANEL" })
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

/**
 * Track when side panel is actually opened
 */
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "SIDE_PANEL_OPENED" && sender.tab?.id) {
    sidePanelState.set(sender.tab.id, true)
  }
})

// ==================== CONTEXT MENU ====================

/**
 * Create context menu item for saving selected text
 * Install default personas on first install
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  // Create context menu
  chrome.contextMenus.create({
    id: "saveToMindKeep",
    title: "Save to MindKeep",
    contexts: ["selection"]
  })

  // Install default personas on first install
  if (details.reason === "install") {
    console.log("🎉 First install detected - installing default personas...")
    
    try {
      for (const personaData of DEFAULT_PERSONAS) {
        await addPersona(personaData)
        console.log(`✅ Installed persona: ${personaData.name}`)
      }
      console.log("✅ All default personas installed successfully")
    } catch (error) {
      console.error("❌ Error installing default personas:", error)
    }
  }
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
 * 1. Receive raw note data (TipTap JSON + plaintext, with optional pre-generated embedding)
 * 2. Generate embedding from PLAINTEXT content (if not provided)
 * 3. Encrypt BOTH the TipTap JSON content and plaintext content
 * 4. Run agent pipeline (multi-pass persona execution)
 * 5. Save final result to database (or skip if agents deleted it)
 */
async function handleSaveNote(data: {
  title: string
  category?: string
  content: string // TipTap JSON as string
  contentPlaintext: string // Plain text extracted from TipTap
  sourceUrl?: string
  embedding?: number[] // Optional pre-generated embedding from side panel
  runAgents?: boolean // Optional flag to enable/disable agents for this note (default: true)
}): Promise<{ success: boolean; note?: any; error?: string }> {
  const startTime = performance.now()

  try {
    console.log("📝 [BG Save] Starting save pipeline...")

    // Step 1: Data Reception (already done via message)
    const { title, category, content, contentPlaintext, sourceUrl, embedding, runAgents } =
      data

    // Step 2: Embedding Generation (from PLAINTEXT)
    // Use pre-generated embedding if provided, otherwise generate here
    let embeddingVector: number[]
    if (embedding && embedding.length > 0) {
      console.log(
        `✅ [BG Save] Using pre-generated embedding: ${embedding.length} dimensions`
      )
      embeddingVector = embedding
    } else {
      const embeddingStartTime = performance.now()
      console.log("🔢 [BG Save] Generating embedding from plaintext content...")
      embeddingVector = await generateEmbedding(contentPlaintext)
      const embeddingTime = performance.now() - embeddingStartTime
      console.log(
        `⏱️ [BG Save] Embedding generation: ${embeddingTime.toFixed(2)}ms (${embeddingVector.length} dimensions)`
      )
    }

    // Step 3: Content Encryption (encrypt BOTH content fields)
    const encryptStartTime = performance.now()
    const encryptedContent = await encrypt(content) // TipTap JSON
    const encryptedPlaintext = await encrypt(contentPlaintext) // Plain text
    const encryptTime = performance.now() - encryptStartTime
    console.log(`⏱️ [BG Save] Content encryption: ${encryptTime.toFixed(2)}ms`)

    // Step 4: Create initial note object (decrypted for agent pipeline)
    const initialNote: Note = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      content, // Unencrypted for agents
      contentPlaintext, // Unencrypted for agents
      category: category || "general",
      embedding: embeddingVector,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sourceUrl
    }

    // Step 5: Run agent pipeline
    const pipelineStartTime = performance.now()
    const pipelineResult = await runAgentPipeline({
      note: initialNote,
      embedding: embeddingVector,
      encryptedContent,
      runAgents // Pass through the flag
    })
    const pipelineTime = performance.now() - pipelineStartTime
    console.log(`⏱️ [BG Save] Agent pipeline: ${pipelineTime.toFixed(2)}ms`)

    // Step 6: Handle pipeline result
    if (pipelineResult.shouldDeleteNote) {
      console.log("🗑️ [BG Save] Agent pipeline deleted the note - not saving")
      return {
        success: true,
        note: null
      }
    }

    if (pipelineResult.shouldSaveNote && pipelineResult.finalNote) {
      // Re-encrypt the final note (may have been modified by agents)
      const finalEncryptedContent = await encrypt(pipelineResult.finalNote.content)
      const finalEncryptedPlaintext = await encrypt(pipelineResult.finalNote.contentPlaintext)

      // Prepare final note for database
      const noteObject = {
        title: pipelineResult.finalNote.title,
        category: pipelineResult.finalNote.category,
        content: finalEncryptedContent,
        contentPlaintext: finalEncryptedPlaintext,
        embedding: pipelineResult.finalNote.embedding || embeddingVector,
        sourceUrl: pipelineResult.finalNote.sourceUrl,
        handledByPersona: pipelineResult.handledByPersona
      }

      // Save to database
      const dbStartTime = performance.now()
      const savedNote = await addNote(noteObject)
      const dbTime = performance.now() - dbStartTime
      console.log(`⏱️ [BG Save] Database storage: ${dbTime.toFixed(2)}ms`)

      const totalTime = performance.now() - startTime
      console.log(
        `⏱️ [BG Save] TOTAL background save time: ${totalTime.toFixed(2)}ms`
      )
      console.log(
        `📊 [BG Save] Breakdown: Encrypt=${encryptTime.toFixed(2)}ms, Pipeline=${pipelineTime.toFixed(2)}ms, DB=${dbTime.toFixed(2)}ms`
      )

      return {
        success: true,
        note: savedNote
      }
    }

    return {
      success: false,
      error: "Pipeline did not produce a valid result"
    }
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.error(
      `❌ [BG Save] Save pipeline failed after ${totalTime.toFixed(2)}ms:`,
      error
    )
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
 * 1. Receive note ID and update data (TipTap JSON + plaintext, with optional pre-generated embedding)
 * 2. Generate new embedding if content changed (from PLAINTEXT, if not provided)
 * 3. Encrypt new content if changed (BOTH JSON and plaintext)
 * 4. Update in database
 */
async function handleUpdateNote(data: {
  id: string
  title?: string
  category?: string
  content?: string // TipTap JSON as string
  contentPlaintext?: string // Plain text extracted from TipTap
  embedding?: number[] // Optional pre-generated embedding from side panel
}): Promise<{ success: boolean; note?: any; error?: string }> {
  const startTime = performance.now()

  try {
    console.log("✏️ [BG Update] Starting update pipeline for note:", data.id)

    const { id, title, category, content, contentPlaintext, embedding } = data
    const updates: any = {}

    // Update title/category if provided (no processing needed)
    if (title !== undefined) updates.title = title
    if (category !== undefined) updates.category = category

    // If content is being updated, process it through the pipeline
    if (content !== undefined && contentPlaintext !== undefined) {
      // Use pre-generated embedding if provided, otherwise generate here
      let embeddingVector: number[]
      if (embedding && embedding.length > 0) {
        console.log(
          `✅ [BG Update] Using pre-generated embedding: ${embedding.length} dimensions`
        )
        embeddingVector = embedding
      } else {
        const embeddingStartTime = performance.now()
        console.log(
          "🔢 [BG Update] Generating new embedding from plaintext content..."
        )
        embeddingVector = await generateEmbedding(contentPlaintext)
        const embeddingTime = performance.now() - embeddingStartTime
        console.log(
          `⏱️ [BG Update] Embedding generation: ${embeddingTime.toFixed(2)}ms (${embeddingVector.length} dimensions)`
        )
      }

      const encryptStartTime = performance.now()
      const encryptedContent = await encrypt(content) // TipTap JSON
      const encryptedPlaintext = await encrypt(contentPlaintext) // Plain text
      const encryptTime = performance.now() - encryptStartTime
      console.log(
        `⏱️ [BG Update] Content encryption: ${encryptTime.toFixed(2)}ms`
      )

      updates.content = encryptedContent
      updates.contentPlaintext = encryptedPlaintext
      updates.embedding = embeddingVector
    }

    const dbStartTime = performance.now()
    const updatedNote = await updateNote(id, updates)
    const dbTime = performance.now() - dbStartTime
    console.log(`⏱️ [BG Update] Database update: ${dbTime.toFixed(2)}ms`)

    if (!updatedNote) {
      throw new Error("Note not found")
    }

    const totalTime = performance.now() - startTime
    console.log(
      `⏱️ [BG Update] TOTAL background update time: ${totalTime.toFixed(2)}ms`
    )

    return {
      success: true,
      note: updatedNote
    }
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.error(
      `❌ [BG Update] Update pipeline failed after ${totalTime.toFixed(2)}ms:`,
      error
    )
    return {
      success: false,
      error: String(error)
    }
  }
}

console.log("🧠 MindKeep background script loaded")
