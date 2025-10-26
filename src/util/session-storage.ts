/**
 * Session Storage Utility
 *
 * Provides utilities for storing temporary data that persists across
 * page navigation but is cleared when the browser/extension is closed.
 *
 * Uses Chrome's session storage API which is perfect for conversation history.
 */

const STORAGE_KEYS = {
  AI_CHAT_MESSAGES: "ai_chat_messages",
  AI_CHAT_METADATA: "ai_chat_metadata"
} as const

export interface ChatMessage {
  id: string
  type: "user" | "ai"
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
 * Save chat messages to session storage
 */
export async function saveChatMessages(messages: ChatMessage[]): Promise<void> {
  try {
    await chrome.storage.session.set({
      [STORAGE_KEYS.AI_CHAT_MESSAGES]: messages,
      [STORAGE_KEYS.AI_CHAT_METADATA]: {
        lastUpdated: Date.now(),
        messageCount: messages.length
      } satisfies ChatMetadata
    })
    console.log(`💾 [Session Storage] Saved ${messages.length} chat messages`)
  } catch (error) {
    console.error("❌ [Session Storage] Failed to save chat messages:", error)
  }
}

/**
 * Load chat messages from session storage
 */
export async function loadChatMessages(): Promise<ChatMessage[]> {
  try {
    const result = await chrome.storage.session.get(STORAGE_KEYS.AI_CHAT_MESSAGES)
    const messages = result[STORAGE_KEYS.AI_CHAT_MESSAGES] || []
    console.log(`📥 [Session Storage] Loaded ${messages.length} chat messages`)
    return messages
  } catch (error) {
    console.error("❌ [Session Storage] Failed to load chat messages:", error)
    return []
  }
}

/**
 * Clear chat messages from session storage
 */
export async function clearChatMessages(): Promise<void> {
  try {
    await chrome.storage.session.remove([
      STORAGE_KEYS.AI_CHAT_MESSAGES,
      STORAGE_KEYS.AI_CHAT_METADATA
    ])
    console.log("🗑️ [Session Storage] Cleared chat messages")
  } catch (error) {
    console.error("❌ [Session Storage] Failed to clear chat messages:", error)
  }
}

/**
 * Get chat metadata
 */
export async function getChatMetadata(): Promise<ChatMetadata | null> {
  try {
    const result = await chrome.storage.session.get(STORAGE_KEYS.AI_CHAT_METADATA)
    return result[STORAGE_KEYS.AI_CHAT_METADATA] || null
  } catch (error) {
    console.error("❌ [Session Storage] Failed to get chat metadata:", error)
    return null
  }
}
