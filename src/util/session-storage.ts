

import { isExtensionContextValid, safeExtensionCall } from "./extension-context"

const STORAGE_KEYS = {
  AI_CHAT_MESSAGES: "ai_chat_messages",
  AI_CHAT_METADATA: "ai_chat_metadata"
} as const

export interface ChatMessage {
  id: string
  type: "user" | "ai" | "system"
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

function isContentScript(): boolean {
  try {

    return (
      typeof window !== "undefined" &&
      window.location.protocol.startsWith("http")
    )
  } catch {
    return false
  }
}

export async function saveChatMessages(messages: ChatMessage[]): Promise<void> {

  if (!isExtensionContextValid()) {
    console.warn("⚠️  [Session Storage] Extension context invalid - skipping save")
    return
  }

  try {
    if (isContentScript()) {

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

export async function loadChatMessages(): Promise<ChatMessage[]> {

  if (!isExtensionContextValid()) {
    console.warn("⚠️  [Session Storage] Extension context invalid - returning empty messages")
    return []
  }

  try {
    if (isContentScript()) {

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

export async function clearChatMessages(): Promise<void> {

  if (!isExtensionContextValid()) {
    console.warn("⚠️  [Session Storage] Extension context invalid - skipping clear")
    return
  }

  try {
    if (isContentScript()) {

      await safeExtensionCall(
        () => chrome.runtime.sendMessage({
          type: "SESSION_STORAGE_CLEAR"
        })
      )
      console.log("🗑️ [Session Storage] Cleared chat messages (via background)")
    } else {

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

export async function getChatMetadata(): Promise<ChatMetadata | null> {

  if (!isExtensionContextValid()) {
    console.warn("⚠️  [Session Storage] Extension context invalid - returning null metadata")
    return null
  }

  try {
    if (isContentScript()) {

      const response = await safeExtensionCall(
        () => chrome.runtime.sendMessage({
          type: "SESSION_STORAGE_GET_METADATA"
        }),
        { metadata: null }
      )
      return response?.metadata || null
    } else {

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
