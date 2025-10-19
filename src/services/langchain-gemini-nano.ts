/**
 * LangChain Adapter for Chrome's Gemini Nano (Prompt API)
 *
 * This adapter wraps Chrome's built-in LanguageModel API to work with LangChain's
 * abstractions, enabling agentic patterns while staying 100% on-device.
 */

import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager"
import {
  SimpleChatModel,
  type BaseChatModelParams
} from "@langchain/core/language_models/chat_models"
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  SystemMessage
} from "@langchain/core/messages"
import { ChatGenerationChunk } from "@langchain/core/outputs"

// Import Chrome AI types from global declarations
import "~types/chrome-ai.d"

/**
 * Configuration options for GeminiNanoChat
 */
export interface GeminiNanoChatInput extends BaseChatModelParams {
  /** Temperature for generation (0-1, higher = more random) */
  temperature?: number
  /** Top-K sampling parameter */
  topK?: number
  /** Initial system prompts to set context */
  initialPrompts?: PromptMessage[]
  /** Maximum tokens for input context */
  maxTokens?: number
}

/**
 * LangChain-compatible chat model using Chrome's Gemini Nano
 *
 * Usage:
 * ```typescript
 * const model = new GeminiNanoChat({
 *   temperature: 0.7,
 *   topK: 40
 * });
 *
 * const response = await model.invoke([
 *   new SystemMessage("You are a helpful assistant"),
 *   new HumanMessage("Hello!")
 * ]);
 * ```
 */
export class GeminiNanoChat extends SimpleChatModel {
  temperature: number = 0.8
  topK: number = 40
  initialPrompts?: PromptMessage[]
  maxTokens: number = 4096

  private session: LanguageModelSession | null = null
  private sessionPromises: Map<string, Promise<LanguageModelSession>> =
    new Map()

  constructor(fields?: GeminiNanoChatInput) {
    super(fields ?? {})
    this.temperature = fields?.temperature ?? 0.8
    this.topK = fields?.topK ?? 40
    this.initialPrompts = fields?.initialPrompts
    this.maxTokens = fields?.maxTokens ?? 4096
  }

  _llmType(): string {
    return "gemini-nano"
  }

  /**
   * Check if Gemini Nano is available
   */
  static async checkAvailability(): Promise<{
    available: boolean
    status: string
    message: string
  }> {
    try {
      if (!("LanguageModel" in self)) {
        return {
          available: false,
          status: "not-supported",
          message: "Gemini Nano not supported in this browser"
        }
      }

      const availability = await LanguageModel.availability()
      return {
        available: availability !== "unavailable",
        status: availability,
        message:
          availability === "available"
            ? "Gemini Nano is ready"
            : availability === "available-after-download"
              ? "Gemini Nano will download on first use"
              : "Gemini Nano is not available"
      }
    } catch (error) {
      return {
        available: false,
        status: "error",
        message: `Error checking availability: ${error}`
      }
    }
  }

  /**
   * Get or create a language model session
   */
  private async getSession(): Promise<LanguageModelSession> {
    if (this.session) {
      console.log("[GeminiNanoChat] Using existing session")
      return this.session
    }

    console.log("[GeminiNanoChat] Creating new session...")

    // Prevent multiple simultaneous session creations
    const sessionKey = "default"
    if (this.sessionPromises.has(sessionKey)) {
      console.log("[GeminiNanoChat] Waiting for pending session creation...")
      return this.sessionPromises.get(sessionKey)!
    }

    const sessionPromise = LanguageModel.create({
      temperature: this.temperature,
      topK: this.topK,
      initialPrompts: this.initialPrompts
    })

    this.sessionPromises.set(sessionKey, sessionPromise)

    try {
      this.session = await sessionPromise
      console.log("[GeminiNanoChat] Session created successfully")
      return this.session
    } catch (error) {
      console.error("[GeminiNanoChat] Failed to create session:", error)
      throw error
    } finally {
      this.sessionPromises.delete(sessionKey)
    }
  }

  /**
   * Convert LangChain messages to Chrome Prompt API format
   */
  private convertMessages(messages: BaseMessage[]): PromptMessage[] {
    return messages.map((msg) => {
      let role: PromptRole

      if (msg instanceof SystemMessage) {
        role = "system"
      } else if (msg instanceof HumanMessage) {
        role = "user"
      } else if (msg instanceof AIMessage) {
        role = "assistant"
      } else {
        // Default to user for unknown types
        role = "user"
      }

      return {
        role,
        content:
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content)
      }
    })
  }

  /**
   * Main method for generating chat responses
   */
  async _call(
    messages: BaseMessage[],
    options?: any,
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    try {
      const session = await this.getSession()
      const promptMessages = this.convertMessages(messages)

      console.log("[GeminiNanoChat] Sending prompt with messages:", {
        count: promptMessages.length,
        messages: promptMessages.map((m) => ({
          role: m.role,
          contentLength: m.content.length
        }))
      })

      // Execute the prompt
      const response = await session.prompt(promptMessages, {
        signal: options?.signal
      })

      console.log("[GeminiNanoChat] Received response:", {
        type: typeof response,
        length: response?.length,
        preview: response?.substring(0, 100)
      })

      if (!response || response.trim() === "") {
        console.warn("[GeminiNanoChat] Empty response from Gemini Nano")
        throw new Error("Gemini Nano returned an empty response")
      }

      return response
    } catch (error) {
      console.error("[GeminiNanoChat] Error generating response:", error)
      throw new Error(`Gemini Nano error: ${error}`)
    }
  }

  /**
   * Streaming support for real-time responses
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options?: any,
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    try {
      const session = await this.getSession()
      const promptMessages = this.convertMessages(messages)

      // Use streaming API
      const stream = session.promptStreaming(promptMessages, {
        signal: options?.signal
      })

      const reader = stream.getReader()
      let accumulatedText = ""

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        // The stream yields string chunks directly
        const text = value as string
        accumulatedText += text

        yield new ChatGenerationChunk({
          message: new AIMessageChunk(text),
          text
        })

        // Notify callback manager
        await runManager?.handleLLMNewToken(text)
      }
    } catch (error) {
      console.error("[GeminiNanoChat] Error streaming response:", error)
      throw new Error(`Gemini Nano streaming error: ${error}`)
    }
  }

  /**
   * Destroy the current session and free resources
   */
  async destroySession(): Promise<void> {
    if (this.session) {
      this.session.destroy()
      this.session = null
    }
  }

  /**
   * Clone the model with different parameters
   */
  async clone(fields?: Partial<GeminiNanoChatInput>): Promise<GeminiNanoChat> {
    return new GeminiNanoChat({
      temperature: fields?.temperature ?? this.temperature,
      topK: fields?.topK ?? this.topK,
      initialPrompts: fields?.initialPrompts ?? this.initialPrompts,
      maxTokens: fields?.maxTokens ?? this.maxTokens
    })
  }
}

/**
 * Factory function to create a Gemini Nano chat model
 */
export async function createGeminiNanoChat(
  options?: GeminiNanoChatInput
): Promise<GeminiNanoChat> {
  // Check availability first
  const availability = await GeminiNanoChat.checkAvailability()

  if (!availability.available) {
    throw new Error(`Cannot create Gemini Nano chat: ${availability.message}`)
  }

  return new GeminiNanoChat(options)
}
