import * as aiService from "~services/ai-service"
import { logger } from "~utils/logger"

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

export async function generateEmbedding(text: string): Promise<number[]> {
  if (isContentScript()) {
    logger.warn(
      " [AI Proxy] Embedding generation not supported in content scripts due to Chrome MV3 limitations"
    )
    logger.warn(" [AI Proxy] Use title-only search instead")
    throw new Error(
      "Embedding generation not available in content script context. Use title-only search instead."
    )
  }
  return await aiService.generateEmbedding(text)
}

export const EmbeddingPipeline = {
  generateEmbedding
}
