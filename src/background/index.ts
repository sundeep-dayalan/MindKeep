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

import { generateEmbedding } from "~services/ai-service"
import { addNote, updateNote } from "~services/db-service"
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
 // IMPORTANT: Open side panel IMMEDIATELY in the user gesture context
 // If we wait for async operations, Chrome will reject it as "not a user gesture"
 await chrome.sidePanel.open({ tabId: tab.id })

 // Now try to get the HTML content
 let content = info.selectionText
 let isHtml = false

 try {
 // First, try to ping the content script to see if it's injected
 const response = await chrome.tabs.sendMessage(
 tab.id,
 { type: "GET_SELECTED_HTML" },
 { frameId: 0 } // Send to main frame
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
 // Fallback to plain text - already set above
 // Note: Content script may not be injected on some pages (chrome://, about:, etc.)
 // or if the page was loaded before the extension was installed/reloaded
 }

 // Send content to side panel
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

// ==================== NOTE PROCESSING PIPELINE ====================

/**
 * Message handler for processing note operations
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
 console.log(
 ` [Background Listener] Received message type: ${message.type}`,
 {
 saveId: message.data?._debugSaveId || "N/A",
 timestamp: Date.now()
 }
 )

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
 * 4. Assemble final object
 * 5. Save to database
 */
async function handleSaveNote(data: {
 title: string
 category?: string
 content: string // TipTap JSON as string
 contentPlaintext: string // Plain text extracted from TipTap
 sourceUrl?: string
 embedding?: number[] // Optional pre-generated embedding from side panel
}): Promise<{ success: boolean; note?: any; error?: string }> {
 const startTime = performance.now()
 const saveId = `save-${Date.now()}-${Math.random().toString(36).substring(7)}`

 try {
 console.log(`[${saveId}] [BG Save] Starting save pipeline...`, {
 title: data.title,
 hasEmbedding: !!data.embedding
 })

 // Step 1: Data Reception (already done via message)
 const { title, category, content, contentPlaintext, sourceUrl, embedding } =
 data

 // Step 2: Embedding Generation (from PLAINTEXT)
 // Use pre-generated embedding if provided, otherwise generate here
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

 // Step 3: Content Encryption (encrypt BOTH content fields)
 const encryptStartTime = performance.now()
 const encryptedContent = await encrypt(content) // TipTap JSON
 const encryptedPlaintext = await encrypt(contentPlaintext) // Plain text
 const encryptTime = performance.now() - encryptStartTime
 console.log(` [BG Save] Content encryption: ${encryptTime.toFixed(2)}ms`)

 // Step 4: Final Data Assembly
 const noteObject = {
 title,
 category: category || "general",
 content: encryptedContent, // ENCRYPTED TipTap JSON
 contentPlaintext: encryptedPlaintext, // ENCRYPTED plain text
 embedding: embeddingVector, // PLAINTEXT vector
 sourceUrl
 }

 // Step 5: Database Storage
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
 console.log(" [BG Update] Starting update pipeline for note:", data.id)

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
 const encryptedContent = await encrypt(content) // TipTap JSON
 const encryptedPlaintext = await encrypt(contentPlaintext) // Plain text
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
