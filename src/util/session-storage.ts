/**
 * Session Storage Utility
 *
 * Provides utilities for storing temporary data that persists across
 * page navigation but is cleared when the browser/extension is closed.
 *
 * Uses Chrome's session storage API which is perfect for conversation history.
 *
 * IMPORTANT: Content scripts cannot directly access chrome.storage.session,
 * so we detect the context and route through the background script when needed.
 */

import { isExtensionContextValid, safeExtensionCall } from "./extension-context"

const STORAGE_KEYS = {
  AI_CHAT_MESSAGES: "ai_chat_messages",
  AI_CHAT_METADATA: "ai_chat_metadata"
} as const

export interface ChatMessage {
  id: string
  type: "user" | "ai" | "system" // Added "system" for session management notices
  content: string
  timestamp: number
  clarificationOptions?: any
  pendingNoteData?: any
  referenceNotes?: any[]
}

export interface ChatMetadata {
  lastUpdated: number
  messageCount: number
}

/**
 * Detect if we're running in a content script context
 * Content scripts have limited access to Chrome APIs
 */
function isContentScript(): boolean {
  try {
    // Content scripts have window object, extension pages don't
    return (
      typeof window !== "undefined" &&
      window.location.protocol.startsWith("http")
    )
  } catch {
    return false
  }
}

/**
 * Save chat messages to session storage
 * Routes through background script if called from content script
 */
export async function saveChatMessages(messages: ChatMessage[]): Promise<void> {
  // Check if extension context is valid
  if (!isExtensionContextValid()) {
    console.warn("⚠️  [Session Storage] Extension context invalid - skipping save")
    return
  }

  try {
    if (isContentScript()) {
      // Route through background script
      await safeExtensionCall(
        () => chrome.runtime.sendMessage({
          type: "SESSION_STORAGE_SAVE",
          data: { messages }
        })
      )
      console.log(
        `💾 [Session Storage] Saved ${messages.length} chat messages (via background)`
      )
    } else {
      // Direct access from extension context
      await chrome.storage.session.set({
        [STORAGE_KEYS.AI_CHAT_MESSAGES]: messages,
        [STORAGE_KEYS.AI_CHAT_METADATA]: {
          lastUpdated: Date.now(),
          messageCount: messages.length
        } satisfies ChatMetadata
      })
      console.log(`💾 [Session Storage] Saved ${messages.length} chat messages`)
    }
  } catch (error) {
    console.error("❌ [Session Storage] Failed to save chat messages:", error)
    throw error
  }
}

/**
 * Load chat messages from session storage
 * Routes through background script if called from content script
 */
export async function loadChatMessages(): Promise<ChatMessage[]> {
  // Check if extension context is valid
  if (!isExtensionContextValid()) {
    console.warn("⚠️  [Session Storage] Extension context invalid - returning empty messages")
    return []
  }

  try {
    if (isContentScript()) {
      // Route through background script
      const response = await safeExtensionCall(
        () => chrome.runtime.sendMessage({
          type: "SESSION_STORAGE_LOAD"
        }),
        { messages: [] }
      )
      const messages = response?.messages || []
      console.log(
        `📥 [Session Storage] Loaded ${messages.length} chat messages (via background)`
      )
      return messages
    } else {
      // Direct access from extension context
      const result = await chrome.storage.session.get(
        STORAGE_KEYS.AI_CHAT_MESSAGES
      )
      const messages = result[STORAGE_KEYS.AI_CHAT_MESSAGES] || []
      console.log(
        `📥 [Session Storage] Loaded ${messages.length} chat messages`
      )
      return messages
    }
  } catch (error) {
    console.error("❌ [Session Storage] Failed to load chat messages:", error)
    return []
  }
}

/**
 * Clear chat messages from session storage
 * Routes through background script if called from content script
 */
export async function clearChatMessages(): Promise<void> {
  // Check if extension context is valid
  if (!isExtensionContextValid()) {
    console.warn("⚠️  [Session Storage] Extension context invalid - skipping clear")
    return
  }

  try {
    if (isContentScript()) {
      // Route through background script
      await safeExtensionCall(
        () => chrome.runtime.sendMessage({
          type: "SESSION_STORAGE_CLEAR"
        })
      )
      console.log("🗑️ [Session Storage] Cleared chat messages (via background)")
    } else {
      // Direct access from extension context
      await chrome.storage.session.remove([
        STORAGE_KEYS.AI_CHAT_MESSAGES,
        STORAGE_KEYS.AI_CHAT_METADATA
      ])
      console.log("🗑️ [Session Storage] Cleared chat messages")
    }
  } catch (error) {
    console.error("❌ [Session Storage] Failed to clear chat messages:", error)
    throw error
  }
}

/**
 * Get chat metadata
 * Routes through background script if called from content script
 */
export async function getChatMetadata(): Promise<ChatMetadata | null> {
  // Check if extension context is valid
  if (!isExtensionContextValid()) {
    console.warn("⚠️  [Session Storage] Extension context invalid - returning null metadata")
    return null
  }

  try {
    if (isContentScript()) {
      // Route through background script
      const response = await safeExtensionCall(
        () => chrome.runtime.sendMessage({
          type: "SESSION_STORAGE_GET_METADATA"
        }),
        { metadata: null }
      )
      return response?.metadata || null
    } else {
      // Direct access from extension context
      const result = await chrome.storage.session.get(
        STORAGE_KEYS.AI_CHAT_METADATA
      )
      return result[STORAGE_KEYS.AI_CHAT_METADATA] || null
    }
  } catch (error) {
    console.error("❌ [Session Storage] Failed to get chat metadata:", error)
    return null
  }
}
