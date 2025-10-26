/**
 * AI Service Proxy
 *
 * This service provides a unified interface for AI operations that works
 * across different Chrome extension contexts:
 *
 * - Extension Pages: Direct access to AI service
 * - Content Scripts: Proxies requests to offscreen document via message passing
 */

import * as aiService from "~services/ai-service"

/**
 * Detect if we're running in a content script context
 */
function isContentScript(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      !window.location.protocol.startsWith("chrome-extension:")
    )
  } catch {
    return false
  }
}

/**
 * Send a message to the offscreen document and wait for response
 */
async function sendToOffscreen<T>(
  type: string,
  payload: any = {}
): Promise<T> {
  try {
    const response = await chrome.runtime.sendMessage({
      type,
      payload
    })

    if (!response.success) {
      throw new Error(response.error || "Operation failed")
    }

    return response.data
  } catch (error) {
    console.error(`[AI Proxy] Error sending message ${type}:`, error)
    throw error
  }
}

/**
 * Generate embedding for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (isContentScript()) {
    console.log("📡 [AI Proxy] Routing generateEmbedding to offscreen")
    return await sendToOffscreen("AI_GENERATE_EMBEDDING", { text })
  }
  return await aiService.generateEmbedding(text)
}

// Re-export the EmbeddingPipeline namespace for compatibility
export const EmbeddingPipeline = {
  generateEmbedding
}
