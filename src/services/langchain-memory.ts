/**
 * LangChain Memory Manager for MindKeep
 *
 * Provides conversation memory for multi-turn dialogues with AI search.
 * Custom implementation optimized for Chrome extensions.
 */

import type {
  BaseMemory,
  InputValues,
  MemoryVariables,
  OutputValues
} from "@langchain/core/memory"
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages"

/**
 * Simple conversation buffer that stores chat messages in memory
 */
export class ConversationBuffer implements BaseMemory {
  private messages: BaseMessage[] = []
  private maxMessages: number
  public memoryKey: string = "history"

  constructor(maxMessages: number = 10) {
    this.maxMessages = maxMessages
  }

  get memoryKeys(): string[] {
    return [this.memoryKey]
  }

  /**
   * Load memory variables (chat history)
   */
  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    return {
      [this.memoryKey]: this.messages
    }
  }

  /**
   * Save context from input/output
   */
  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const input = inputValues.input || inputValues.question || ""
    const output = outputValues.output || outputValues.response || ""

    if (input) {
      this.messages.push(new HumanMessage(input))
    }

    if (output) {
      this.messages.push(new AIMessage(output))
    }

    // Trim to max messages (keep most recent)
    if (this.messages.length > this.maxMessages * 2) {
      // *2 because each turn has 2 messages
      this.messages = this.messages.slice(-this.maxMessages * 2)
    }
  }

  /**
   * Add a message directly
   */
  addMessage(message: BaseMessage): void {
    this.messages.push(message)
    if (this.messages.length > this.maxMessages * 2) {
      this.messages = this.messages.slice(-this.maxMessages * 2)
    }
  }

  /**
   * Get all messages
   */
  getMessages(): BaseMessage[] {
    return [...this.messages]
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.messages = []
  }
}

/**
 * Create a new conversation memory instance
 *
 * @param maxMessages - Maximum number of message pairs to keep in memory (default: 10)
 * @returns A configured ConversationBuffer instance
 */
export function createConversationMemory(
  maxMessages: number = 10
): ConversationBuffer {
  return new ConversationBuffer(maxMessages)
}

/**
 * Memory manager for multiple concurrent conversations
 */
export class ConversationMemoryManager {
  private memories: Map<string, ConversationBuffer> = new Map()
  private maxMessages: number

  constructor(maxMessages: number = 10) {
    this.maxMessages = maxMessages
  }

  /**
   * Get or create a memory instance for a conversation
   */
  getMemory(conversationId: string): ConversationBuffer {
    if (!this.memories.has(conversationId)) {
      this.memories.set(
        conversationId,
        createConversationMemory(this.maxMessages)
      )
    }
    return this.memories.get(conversationId)!
  }

  /**
   * Clear memory for a specific conversation
   */
  clearMemory(conversationId: string): void {
    const memory = this.memories.get(conversationId)
    if (memory) {
      memory.clear()
    }
  }

  /**
   * Delete a conversation entirely
   */
  deleteConversation(conversationId: string): void {
    this.memories.delete(conversationId)
  }

  /**
   * Get all active conversation IDs
   */
  getActiveConversations(): string[] {
    return Array.from(this.memories.keys())
  }

  /**
   * Clear all memories
   */
  clearAll(): void {
    for (const memory of this.memories.values()) {
      memory.clear()
    }
    this.memories.clear()
  }
}

/**
 * Singleton instance for the entire application
 */
export const conversationManager = new ConversationMemoryManager()
