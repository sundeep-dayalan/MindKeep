/**
 * AI Service Proxy
 *
 * This service provides a unified interface for AI operations that works
 * across different Chrome extension contexts:
 *
 * - Extension Pages (sidepanel, popup): Direct access to AI service with full WASM support
 * - Content Scripts: Falls back to title-only search (no embeddings due to MV3 limitations)
 *
 * IMPORTANT: Transformers.js (for embeddings) requires URL.createObjectURL which is NOT
 * available in Chrome MV3 service workers or offscreen documents that load service worker code.
 * Therefore, embedding generation only works in full DOM contexts (sidepanel, popup).
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
 * Generate embedding for text
 *
 * NOTE: This will throw an error if called from a content script context
 * because embeddings require full DOM environment (URL.createObjectURL)
 * which is not available in service workers or their offscreen documents.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (isContentScript()) {
    console.warn(
      "⚠️  [AI Proxy] Embedding generation not supported in content scripts due to Chrome MV3 limitations"
    )
    console.warn("⚠️  [AI Proxy] Use title-only search instead")
    throw new Error(
      "Embedding generation not available in content script context. Use title-only search instead."
    )
  }
  return await aiService.generateEmbedding(text)
}

// Re-export the EmbeddingPipeline namespace for compatibility
export const EmbeddingPipeline = {
  generateEmbedding
}
