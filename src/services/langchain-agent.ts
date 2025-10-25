/**
 * Agentic Search System for MindKeep
 *
 * Uses native Prompt API sessions for conversation management
 * with LangChain tools for structured note operations.
 */

import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

import type { Persona } from "~types/persona"
import { AgentMode } from "~types/persona"

import type { SessionMetadata } from "./gemini-nano-service"
import * as GeminiNanoService from "./gemini-nano-service"
import { allTools } from "./langchain-tools"

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Structured response from the agent
 * Provides both extracted data and conversational AI response
 */
export interface AgentResponse {
  /** The extracted/requested data (email, password, URL, etc.) */
  extractedData: string | null

  /** IDs of notes that were referenced to answer the query */
  referenceNotes: string[]

  /** Natural language response from the AI */
  aiResponse: string

  /** Type of data extracted (helps UI determine how to display it) */
  dataType?: "email" | "password" | "url" | "text" | "code" | "date" | "other"

  /** Confidence score (0-1) - how confident is the AI about the extracted data */
  confidence?: number

  /** Suggested actions the user can take */
  suggestedActions?: Array<{
    type: "copy" | "fill" | "view_note" | "open_link"
    label: string
    data: any
  }>

  /** Indicates if agent needs clarification from user */
  needsClarification?: boolean

  /** Type of clarification needed */
  clarificationType?:
    | "title"
    | "category"
    | "both"
    | "content"
    | "organize_confirmation"

  /** Options for user to select (for clarification) */
  clarificationOptions?: Array<{
    type: "button" | "category_pill"
    label: string
    value: any
    action: string // e.g., "select_category", "auto_generate_title", "manual_title"
  }>

  /** Pending note data waiting for clarification */
  pendingNoteData?: {
    content?: string
    title?: string
    category?: string
    noteId?: string
    currentCategory?: string
    suggestedCategory?: string
  }

  /** Indicates if a note was successfully created */
  noteCreated?: boolean
}

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

const AGENT_SYSTEM_PROMPT = `You are MindKeep AI, a helpful assistant that helps users search and manage their personal notes.

You have access to these tools:
- search_notes: Search through notes using semantic similarity
- get_note: Retrieve a specific note by ID
- create_note: Create a new note
- create_note_from_chat: Create a note from the current conversation (smart parameter extraction)
- update_note: Update an existing note
- delete_note: Delete a note
- list_categories: List all note categories
- get_statistics: Get comprehensive statistics about notes (total count, notes per category, creation/update dates)
- organize_note: Automatically organize notes by finding semantically similar notes and suggesting better category placement
- confirm_organize_note: Confirm and execute category reorganization after user approval

When helping users:
1. Understand their intent clearly
2. Use appropriate tools to fetch information
3. Provide clear, concise answers based on the results
4. Always cite which notes you're referencing
5. If you can't find information, say so clearly

For note creation from chat (create_note_from_chat):
- Use this when users say "add this as note", "save that as note", etc.
- Extract title if mentioned (e.g., "add as note with title AWS" → title: "AWS")
- Extract category if mentioned (e.g., "add under aws category" → category: "aws")
- If content is in the current message, extract it; otherwise use conversation context
- The tool will handle clarification for missing title/category

Important:
- Be conversational and friendly
- Keep responses concise (2-3 sentences when possible)
- Always protect user privacy - all data stays on their device
- If a tool returns an error, explain it to the user helpfully
- When user asks about any sensitive information, dont aware them because all data is stored locally and securely. Give them the information directly if you found in notes.
- When asked about "how many notes" or "statistics", use the get_statistics tool`

// ============================================================================
// CONTENT OPTIMIZATION UTILITIES
// ============================================================================

/**
 * Estimate token count for text (rough approximation)
 * @param text The text to estimate tokens for
 * @returns Estimated token count
 */
function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 3.5 characters for English
  // For JSON, account for formatting overhead
  return Math.ceil(text.length / 3.5)
}

/**
 * Extract relevant content based on query keywords (query-aware truncation)
 * @param noteContent The full note content
 * @param query The user's search query
 * @param maxLength Maximum length of extracted content
 * @returns Optimized content that prioritizes query-relevant sections
 */
function extractRelevantContent(
  noteContent: string,
  query: string,
  maxLength: number = 500
): string {
  if (noteContent.length <= maxLength) {
    return noteContent
  }

  // Strategy A: Keyword matching
  const queryKeywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3) // "netflix", "password", etc.

  if (queryKeywords.length > 0) {
    // Split into sentences
    const sentences = noteContent.split(/[.!?]+/).filter((s) => s.trim())

    // Find sentences containing query keywords
    const relevantSentences: Array<{ sentence: string; score: number }> = []

    sentences.forEach((sentence) => {
      const lowerSentence = sentence.toLowerCase()
      let score = 0

      // Calculate relevance score based on keyword matches
      queryKeywords.forEach((keyword) => {
        if (lowerSentence.includes(keyword)) {
          score += 1
        }
      })

      if (score > 0) {
        relevantSentences.push({ sentence: sentence.trim(), score })
      }
    })

    // Sort by relevance score (highest first)
    relevantSentences.sort((a, b) => b.score - a.score)

    // Build result from most relevant sentences until maxLength
    if (relevantSentences.length > 0) {
      let result = ""
      for (const { sentence } of relevantSentences) {
        if (result.length + sentence.length + 2 <= maxLength) {
          result += sentence + ". "
        } else {
          break
        }
      }

      if (result.length > 0) {
        return result.trim()
      }
    }
  }

  // Strategy B: Fallback to sandwich approach (beginning + end)
  // Keep first 40% and last 40%, skip middle 20%
  const firstPartLength = Math.floor(maxLength * 0.4)
  const lastPartLength = Math.floor(maxLength * 0.4)

  const firstPart = noteContent.substring(0, firstPartLength)
  const lastPart = noteContent.substring(noteContent.length - lastPartLength)

  return `${firstPart} [...] ${lastPart}`
}

/**
 * Optimize a message for session context to prevent token overflow
 * Uses sandwich approach: keeps beginning (context) + end (user's request)
 * @param message The full message content
 * @param maxTokens Maximum tokens to allow
 * @returns Optimized message that fits within token budget
 */
function optimizeMessageForSession(
  message: string,
  maxTokens: number = 1000
): string {
  const estimatedTokens = estimateTokens(message)

  if (estimatedTokens <= maxTokens) {
    return message // Small enough, no truncation needed
  }

  console.log(
    `[Content Optimizer] Message too large: ${estimatedTokens} tokens > ${maxTokens} tokens. Truncating...`
  )

  // For large content: Use "sandwich" approach
  // Keep beginning (context/topic) + end (often has the ask/question)
  const maxChars = Math.floor(maxTokens * 3.5)
  const beginChars = Math.floor(maxChars * 0.3) // 30% from start (context)
  const endChars = Math.floor(maxChars * 0.7) // 70% from end (user's request)

  const beginning = message.substring(0, beginChars)
  const ending = message.substring(message.length - endChars)

  const truncatedTokens = estimatedTokens - maxTokens
  const optimized = `${beginning}\n\n[... content truncated: ~${truncatedTokens} tokens removed for optimization ...]\n\n${ending}`

  console.log(
    `[Content Optimizer] Truncated: ${estimatedTokens} → ${estimateTokens(optimized)} tokens`
  )

  return optimized
}

/**
 * Build optimized session history that fits within token budget
 * Uses rolling window: recent messages get priority
 * @param conversationHistory Full conversation history
 * @param currentMessage Current user message
 * @param maxTotalTokens Maximum total tokens for history
 * @returns Optimized history array that fits budget
 */
function buildOptimizedSessionHistory(
  conversationHistory: Array<{ role: string; content: string }>,
  currentMessage: string,
  maxTotalTokens: number = 4000 // Reserve ~5000 for system prompts + response
): Array<{ role: string; content: string }> {
  if (!conversationHistory || conversationHistory.length === 0) {
    return []
  }

  console.log(
    `[Session Optimizer] Building optimized history from ${conversationHistory.length} messages, max ${maxTotalTokens} tokens`
  )

  // Start with current message tokens (already sent, can't change)
  let totalTokens = estimateTokens(currentMessage)
  const optimizedHistory: Array<{ role: string; content: string }> = []

  // Work backwards from most recent (most relevant context)
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i]
    const msgTokens = estimateTokens(msg.content)

    if (totalTokens + msgTokens <= maxTotalTokens) {
      // Fits! Add it as-is
      optimizedHistory.unshift(msg)
      totalTokens += msgTokens
      console.log(
        `[Session Optimizer] Added message ${i}: ${msgTokens} tokens (total: ${totalTokens})`
      )
    } else {
      // Doesn't fit - try to add truncated version
      const remainingTokens = maxTotalTokens - totalTokens

      if (remainingTokens > 100) {
        // Only add if we can preserve meaningful content
        const truncatedMsg = {
          role: msg.role,
          content: optimizeMessageForSession(msg.content, remainingTokens)
        }
        optimizedHistory.unshift(truncatedMsg)
        totalTokens += estimateTokens(truncatedMsg.content)
        console.log(
          `[Session Optimizer] Added truncated message ${i}: ${remainingTokens} tokens (total: ${totalTokens})`
        )
      } else {
        console.log(
          `[Session Optimizer] Skipping message ${i}: insufficient remaining tokens (${remainingTokens})`
        )
      }

      // Stop processing older messages
      break
    }
  }

  console.log(
    `[Session Optimizer] Final: ${optimizedHistory.length}/${conversationHistory.length} messages, ~${totalTokens} tokens`
  )

  return optimizedHistory
}

// ============================================================================
// SIMPLE AGENT (Native Session-based)
// ============================================================================

export interface AgentConfig {
  tools?: typeof allTools
  maxIterations?: number
  verbose?: boolean
  temperature?: number
  topK?: number
}

export class MindKeepAgent {
  private sessionId: string | null = null // Native Prompt API session
  private tools: typeof allTools
  private maxIterations: number
  private verbose: boolean
  private temperature: number
  private topK: number
  private lastUserMessage: string = "" // Track the last user message content
  private conversationHistory: Array<{ role: string; content: string }> = [] // Full conversation history for tools (DEPRECATED - kept for compatibility)
  private rawConversationHistory: Array<{ role: string; content: string }> = [] // NEW: Untruncated history for tool content extraction
  private activePersona: Persona | null = null // Active persona for search-only mode
  private mode: AgentMode = AgentMode.DEFAULT // Current operating mode

  constructor(config: AgentConfig = {}) {
    this.tools = config.tools || allTools
    this.maxIterations = config.maxIterations || 5
    this.verbose = config.verbose || false
    this.temperature = config.temperature || 0.8
    this.topK = config.topK || 3
  }

  /**
   * Initialize the agent by creating a session
   * Must be called before using the agent
   */
  async initialize(): Promise<void> {
    console.log(" [Agent] Initializing agent with native session...")

    try {
      this.sessionId = await GeminiNanoService.createSession({
        systemPrompt: this.buildSystemPrompt(),
        temperature: this.temperature,
        topK: this.topK
      })

      console.log(` [Agent] Agent initialized with session: ${this.sessionId}`)
    } catch (error) {
      console.error(" [Agent] Failed to initialize agent:", error)
      throw new Error(`Failed to initialize agent: ${error.message}`)
    }
  }

  /**
   * Check if agent is initialized
   */
  isInitialized(): boolean {
    return this.sessionId !== null
  }

  /**
   * Set active persona (enters PERSONA mode with search-only tools)
   * Destroys current session and creates a new one with updated system prompt
   * @param persona - The persona to activate, or null to return to DEFAULT mode
   */
  async setPersona(persona: Persona | null): Promise<void> {
    console.log(
      " [Agent] setPersona called with:",
      persona?.name || "null (default mode)"
    )

    this.activePersona = persona
    this.mode = persona ? AgentMode.PERSONA : AgentMode.DEFAULT

    // Destroy old session and create new one with updated system prompt
    console.log(" [Agent] Recreating session due to persona change")

    if (this.sessionId) {
      await GeminiNanoService.destroySession(this.sessionId)
    }

    // Create new session with updated system prompt
    this.sessionId = await GeminiNanoService.createSession({
      systemPrompt: this.buildSystemPrompt(),
      temperature: this.temperature,
      topK: this.topK
    })

    console.log(` [Agent] Mode set to: ${this.mode}`)
    console.log(` [Agent] Active persona: ${persona?.name || "None"}`)
    console.log(` [Agent] New session: ${this.sessionId}`)
  }

  /**
   * Get the current active persona
   */
  getPersona(): Persona | null {
    return this.activePersona
  }

  /**
   * Get the current operating mode
   */
  getMode(): AgentMode {
    return this.mode
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.sessionId
  }

  /**
   * Clear the conversation session and start fresh
   * Destroys the current session and creates a new one
   */
  async clearSession(): Promise<void> {
    console.log(" [Agent] Clearing conversation session...")

    // Destroy the current session
    await GeminiNanoService.destroySession(this.sessionId)

    // Create a new session with the same configuration
    this.sessionId = await GeminiNanoService.createSession({
      systemPrompt: this.buildSystemPrompt(),
      temperature: this.temperature,
      topK: this.topK
    })

    // Clear last user message
    this.lastUserMessage = null

    console.log(` [Agent] Session cleared. New session: ${this.sessionId}`)
  }

  /**
   * Create a summary of recent conversation for session rotation
   * @param messages Recent conversation messages to summarize
   * @returns Concise summary string
   */
  private async createContextSummary(
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    if (messages.length === 0) {
      return "No previous conversation context."
    }

    try {
      const conversationText = messages
        .map(
          (msg) =>
            `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
        )
        .join("\n")

      const summaryPrompt = `Summarize this conversation in 2-3 sentences, preserving key topics and context:

${conversationText}

Provide ONLY the summary, no preamble.`

      const summary = await GeminiNanoService.executePrompt(summaryPrompt, {
        temperature: 0.3,
        topK: 1
      })

      console.log(
        ` [Session Rotation] Context summary created: ${summary.length} chars`
      )
      return summary.trim()
    } catch (error) {
      console.error(" [Session Rotation] Failed to create summary:", error)
      // Fallback: use last message
      const lastMsg = messages[messages.length - 1]
      return `Previous conversation about: ${lastMsg.content.substring(0, 100)}...`
    }
  }

  /**
   * Rotate session when approaching token limit
   * Creates a new session with summarized context from the old one
   */
  async rotateSessionWithSummary(): Promise<void> {
    console.log("🔄 [Agent] Rotating session to prevent token overflow...")

    try {
      // Get last 4 messages for context summary
      const recentMessages = this.rawConversationHistory.slice(-4)

      // Create summary of recent conversation
      const summary = await this.createContextSummary(recentMessages)

      // Destroy old session
      await GeminiNanoService.destroySession(this.sessionId)

      // Create new session with summary as initial context
      this.sessionId = await GeminiNanoService.createSession({
        systemPrompt: this.buildSystemPrompt(),
        temperature: this.temperature,
        topK: this.topK,
        initialPrompts: [
          {
            role: "user",
            content: `[Context from previous conversation: ${summary}]`
          },
          {
            role: "assistant",
            content:
              "I understand the previous context. How can I continue helping you?"
          }
        ]
      })

      console.log(`✅ [Agent] Session rotated successfully: ${this.sessionId}`)
      console.log(
        ` [Agent] Context preserved: "${summary.substring(0, 100)}..."`
      )
    } catch (error) {
      console.error("❌ [Agent] Session rotation failed:", error)
      // Fallback to simple clear
      await this.clearSession()
    }
  }

  /**
   * Get available tools based on current mode
   * DEFAULT mode: All tools
   * PERSONA mode: Search-only tools (search_notes, get_note)
   */
  private getAvailableTools(): typeof allTools {
    if (this.mode === AgentMode.PERSONA) {
      console.log(" [Agent] PERSONA mode - filtering to search-only tools")

      // Only allow read-only tools in persona mode
      const searchOnlyTools = allTools.filter(
        (tool) => tool.name === "search_notes" || tool.name === "get_note"
      )

      console.log(
        ` [Agent] Available tools in PERSONA mode: ${searchOnlyTools.map((t) => t.name).join(", ")}`
      )

      return searchOnlyTools as typeof allTools
    }

    console.log(
      ` [Agent] DEFAULT mode - all ${allTools.length} tools available`
    )
    return this.tools
  }

  /**
   * Build system prompt based on current mode and persona
   */
  private buildSystemPrompt(): string {
    let systemPrompt = AGENT_SYSTEM_PROMPT

    if (this.mode === AgentMode.PERSONA && this.activePersona) {
      console.log(
        ` [Agent] Building PERSONA mode system prompt for: ${this.activePersona.name}`
      )

      systemPrompt = `You are MindKeep AI, operating in PERSONA mode as "${this.activePersona.name}".

=== PERSONA CONTEXT ===
${this.activePersona.context}

${this.activePersona.outputTemplate ? `=== OUTPUT TEMPLATE ===\n${this.activePersona.outputTemplate}\n` : ""}
=== IMPORTANT CONSTRAINTS ===
- You can ONLY search and read notes (use search_notes and get_note tools)
- You CANNOT create, update, delete, or organize notes
- Your role is to find information and present it according to the persona's style
- ALWAYS search for relevant notes first using search_notes tool
- Format your responses according to the persona context above
- If search returns no results, inform the user politely in your persona's style
- Don't make up information - only use data from notes

=== AVAILABLE TOOLS ===
- search_notes: Search through notes using semantic similarity
- get_note: Retrieve a specific note by ID

When helping users:
1. ALWAYS use search_notes tool first to find relevant information
2. Extract and understand the information from the search results
3. Format your response according to the persona's style and context
4. Be helpful and stay in character
5. If no notes are found, suggest creating a note about the topic`

      console.log(
        " [Agent] Persona system prompt built (length:",
        systemPrompt.length,
        "chars)"
      )
    } else {
      console.log(" [Agent] Using DEFAULT system prompt")
    }

    return systemPrompt
  }

  /**
   * Optimize tool results to fit within token budget for LLM
   * Applies smart truncation and content extraction to prevent context overflow
   * @param toolResults The raw tool results
   * @param query The user's query for context-aware optimization
   * @param maxTotalTokens Maximum total tokens allowed (default: 4000 for Gemini Nano)
   * @returns Optimized tool results
   */
  private async optimizeToolResultsForLLM(
    toolResults: any[],
    query: string,
    maxTotalTokens: number = 4000
  ): Promise<any[]> {
    const optimized = []
    let currentTokenCount = 0

    for (const result of toolResults) {
      // Only optimize search_notes results (other tools return small data)
      if (result.tool === "search_notes" && result.result?.notes) {
        const notes = result.result.notes
        const optimizedNotes = []

        console.log(
          `[Optimizer] Processing ${notes.length} notes from search results`
        )

        for (const note of notes) {
          // Remove embedding arrays (they're huge and not needed for extraction)
          if (note.embedding) {
            delete note.embedding
          }

          // Preserve original content length for logging
          const originalLength = note.content?.length || 0

          // Apply query-aware content extraction to fit within token budget
          note.content = extractRelevantContent(note.content || "", query, 400)

          console.log(
            `[Optimizer] Optimized note ${note.id}: ${originalLength} → ${note.content.length} chars`
          )

          // Step 3: Token budget check
          const noteTokens = estimateTokens(JSON.stringify(note))

          if (currentTokenCount + noteTokens > maxTotalTokens) {
            console.warn(
              `[Optimizer] Token budget exceeded (${currentTokenCount + noteTokens}/${maxTotalTokens}). Attempting harder truncation...`
            )

            // If we're at limit, try harder truncation
            note.content = note.content.substring(0, 150)
            const newTokens = estimateTokens(JSON.stringify(note))

            if (currentTokenCount + newTokens > maxTotalTokens) {
              console.warn(
                `[Optimizer] Even with truncation, budget exceeded. Skipping note ${note.id}`
              )
              break // Skip this note entirely
            }

            console.log(
              `[Optimizer] Hard truncation applied to note ${note.id}: ${noteTokens} → ${newTokens} tokens`
            )
            currentTokenCount += newTokens
          } else {
            currentTokenCount += noteTokens
          }

          optimizedNotes.push(note)
        }

        console.log(
          `[Optimizer] Final result: ${optimizedNotes.length}/${notes.length} notes included, ~${currentTokenCount} tokens used`
        )

        result.result.notes = optimizedNotes
      }

      optimized.push(result)
    }

    return optimized
  }

  /**
   * Process a user query through the agent
   * Returns structured response with extracted data + AI message
   */
  async run(
    input: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<AgentResponse> {
    if (!this.sessionId) {
      throw new Error("Agent not initialized. Call initialize() first.")
    }

    if (this.verbose) {
      console.log(`\n [Agent] Processing query: "${input}"`)
      const metadata = GeminiNanoService.getSessionMetadata(this.sessionId)
      console.log(
        ` [Agent] Session usage: ${metadata?.inputUsage}/${metadata?.inputQuota} tokens`
      )
    }

    // Store RAW conversation history (untruncated) for tool content extraction
    this.rawConversationHistory = conversationHistory || []

    // Store conversation history for tools to access (DEPRECATED - keeping for compatibility)
    this.conversationHistory = conversationHistory || []

    // Track the last user message for note creation from chat
    this.lastUserMessage = input

    // Check token usage and auto-rotate if approaching limit
    const usage = GeminiNanoService.getSessionTokenUsage(this.sessionId)
    if (usage && usage.percentage >= 70) {
      console.warn(
        `⚠️ [Agent] Token usage high: ${usage.usage}/${usage.quota} (${usage.percentage.toFixed(1)}%)`
      )

      // Auto-rotate at 80% to prevent overflow
      if (usage.percentage >= 80) {
        console.error(
          `🔴 [Agent] Token usage critical! ${usage.percentage.toFixed(1)}% used`
        )
        console.log(`🔄 [Agent] Auto-rotating session to prevent overflow...`)

        try {
          await this.rotateSessionWithSummary()
          console.log(
            `✅ [Agent] Session rotation complete. Ready to continue.`
          )
        } catch (error) {
          console.error(`❌ [Agent] Session rotation failed:`, error)
          console.log(`⚠️ [Agent] Falling back to simple session clear...`)
          await this.clearSession()
        }
      } else {
        console.warn(
          `💡 [Agent] Session will auto-rotate at 80% usage to maintain performance`
        )
      }
    }

    try {
      // Step 1: Determine which tools to use (if any)
      const toolsNeeded = await this.selectTools(input, this.sessionId)

      if (this.verbose) {
        console.log(`[Agent] Tools selected:`, toolsNeeded)
      }

      // Step 2: Execute tools if needed
      let toolResults: any[] = []
      let referenceNotes: string[] = []

      if (toolsNeeded.length > 0) {
        toolResults = await this.executeTools(toolsNeeded, input)
        console.log("Tool Results:", toolResults)

        // Extract note IDs from tool results
        try {
          if (toolResults.length > 0) {
            // Extract notes from search results
            const searchResult = toolResults.find(
              (t) => t.tool === "search_notes"
            )
            if (
              searchResult?.result?.notes &&
              Array.isArray(searchResult.result.notes)
            ) {
              referenceNotes = searchResult.result.notes.map(
                (note: any) => note.id
              )
            }
          }
        } catch (e) {
          console.warn("Could not extract note IDs from tool results:", e)
        }

        if (this.verbose) {
          console.log(`[Agent] Tool results:`, toolResults)
          console.log(`[Agent] Reference notes:`, referenceNotes)
        }
      }

      console.log("Tool Results:", toolResults)

      // Handle conversational queries (no tools needed)
      if (toolResults.length === 0) {
        console.log(
          "[Agent] No tools needed - handling as conversational query"
        )

        // Generate a conversational response using a FRESH gemini nano session
        // (not the LangChain model that's configured for tool selection)
        const baseIntro =
          this.mode === AgentMode.PERSONA && this.activePersona
            ? `You are MindKeep AI, operating as "${this.activePersona.name}". ${this.activePersona.description}`
            : `You are MindKeep AI, a helpful assistant for managing personal notes.`

        // Build conversation context from history (last 5 messages)
        let conversationContext = ""
        if (conversationHistory && conversationHistory.length > 0) {
          const recentHistory = conversationHistory.slice(-5)
          conversationContext =
            "\n\nRecent conversation:\n" +
            recentHistory
              .map(
                (msg) =>
                  `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
              )
              .join("\n")
        }

        const conversationPrompt = `${baseIntro}
${conversationContext}

Current user message: "${input}"

This is a general conversation or greeting. Respond naturally and helpfully based on the conversation context. Keep it brief (1-2 sentences).
${this.mode === AgentMode.PERSONA && this.activePersona ? `Stay in character as ${this.activePersona.name}.` : ""}

IMPORTANT:
- If the user is asking about something mentioned in the recent conversation, reference it in your response
- Be contextually aware and maintain conversation flow
- If asked "do you know why...", check if the reason was mentioned in the conversation context above
- **If user expresses INTENT to create/add/save a note WITHOUT providing content**, ask what they'd like to save

Examples:
- "Hello" → "Hi! I'm MindKeep AI. I can help you search your notes, create new notes, or answer questions about your saved information."
- "Thanks" → "You're welcome! Let me know if you need anything else."
- "How are you?" → "I'm doing great! How can I help you with your notes today?"
- "I need to create a note" → "I can create a note for you! What would you like the note to contain?"
- "I want to add a note" → "Sure! What information would you like to save?"
- With context [User: "I got hurt"] + "do you know why i am sad?" → "Yes, you mentioned that you got hurt. I'm sorry to hear that."

Respond with ONLY the natural conversational text, no JSON or formatting.`

        console.log(
          ` [Agent] Generating conversational response in ${this.mode} mode with context`
        )

        const responseText = await GeminiNanoService.promptWithSession(
          this.sessionId!,
          conversationPrompt
        )

        console.log("[Agent] Conversational response:", responseText)

        return {
          extractedData: null,
          referenceNotes: [],
          aiResponse: responseText?.trim(),
          dataType: "text",
          confidence: 1.0
        }
      }

      // Check if any tool requested clarification
      const clarificationNeeded = toolResults.find(
        (result) => result.result?.needsClarification
      )

      if (clarificationNeeded) {
        const clarificationData = clarificationNeeded.result
        console.log("[Agent] Clarification needed:", clarificationData)

        // Generate clarification options based on type
        const clarificationOptions =
          await this.generateClarificationOptions(clarificationData)

        return {
          extractedData: null,
          referenceNotes: [],
          aiResponse: clarificationData.message,
          needsClarification: true,
          clarificationType: clarificationData.clarificationType,
          clarificationOptions: clarificationOptions,
          pendingNoteData: {
            content: clarificationData.noteContent,
            title: clarificationData.noteTitle,
            category: clarificationData.noteCategory
          }
        }
      }

      // Check if a note was successfully created (skip extraction for creation confirmations)
      const noteCreated = toolResults.find(
        (result) => result.result?.noteCreated === true
      )

      if (noteCreated) {
        const creationData = noteCreated.result
        console.log("[Agent] Note created successfully:", creationData)

        // Automatically run the organize_note tool to suggest better category placement
        if (creationData.noteData?.id) {
          console.log(
            "[Agent] Running organize_note tool for newly created note:",
            creationData.noteData.id
          )

          try {
            const organizeResult = await this.executeTools(
              [
                {
                  name: "organize_note",
                  params: {
                    noteId: creationData.noteData.id
                  }
                }
              ],
              input
            )

            console.log("[Agent] Organize result:", organizeResult)

            // Check if reorganization is needed
            const organizeData = organizeResult[0]?.result
            if (
              organizeData?.needsReorganization &&
              organizeData?.suggestedCategory
            ) {
              console.log(
                "[Agent] Reorganization suggested:",
                organizeData.suggestedCategory
              )

              // Return a response asking for user confirmation
              return {
                extractedData: null,
                referenceNotes: [],
                aiResponse: `${creationData.message}\n\n${organizeData.message}`,
                dataType: "text",
                confidence: 1.0,
                noteCreated: true,
                needsClarification: true,
                clarificationType: "organize_confirmation",
                clarificationOptions: [
                  {
                    type: "button",
                    label: " Yes, move it",
                    value: {
                      action: "confirm_organize",
                      noteId: organizeData.noteId,
                      targetCategory: organizeData.suggestedCategory,
                      confirmed: true
                    },
                    action: "confirm_organize"
                  },
                  {
                    type: "button",
                    label: " No, keep it here",
                    value: {
                      action: "confirm_organize",
                      noteId: organizeData.noteId,
                      targetCategory: organizeData.suggestedCategory,
                      confirmed: false
                    },
                    action: "confirm_organize"
                  }
                ],
                pendingNoteData: {
                  noteId: organizeData.noteId,
                  currentCategory: organizeData.currentCategory,
                  suggestedCategory: organizeData.suggestedCategory
                }
              }
            } else {
              console.log(
                "[Agent] No reorganization needed or no similar notes found"
              )
            }
          } catch (error) {
            console.error("[Agent] Error running organize_note:", error)
            // Don't fail the entire operation, just log and continue
          }
        }

        return {
          extractedData: null,
          referenceNotes: [],
          aiResponse: creationData.message, // Use the message directly from the tool
          dataType: "text",
          confidence: 1.0,
          noteCreated: true // Flag to indicate note was created
        }
      }

      // Step 3: Generate structured response
      // History is automatically managed by the session
      const response = await this.generateResponse(
        input,
        toolResults,
        referenceNotes,
        this.sessionId
      )

      console.log("Structured response:", response)

      return response
    } catch (error) {
      console.error("[Agent] Error:", error)
      return {
        extractedData: null,
        referenceNotes: [],
        aiResponse: `I encountered an error: ${error.message}. Please try again.`
      }
    }
  }

  /**
   * Process a user query through the agent with STREAMING response
   * Returns an async generator that yields response chunks
   *
   * @param input User query string
   * @param conversationHistory Conversation history for context
   * @returns AsyncGenerator yielding response chunks and final AgentResponse
   */
  async *runStream(
    input: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ): AsyncGenerator<{
    type: "chunk" | "complete"
    data: string | AgentResponse
  }> {
    if (!this.sessionId) {
      throw new Error("Agent not initialized. Call initialize() first.")
    }

    // Store histories (same as run())
    this.rawConversationHistory = conversationHistory || []
    this.conversationHistory = conversationHistory || []
    this.lastUserMessage = input

    // Check and auto-rotate session if needed
    const usage = GeminiNanoService.getSessionTokenUsage(this.sessionId)
    if (usage && usage.percentage >= 80) {
      console.log(
        `🔄 [Agent Stream] Auto-rotating session at ${usage.percentage.toFixed(1)}%...`
      )
      await this.rotateSessionWithSummary()
    }

    try {
      // Step 1: Determine tools (non-streaming, needs to be quick)
      const toolsNeeded = await this.selectTools(input, this.sessionId)

      // Step 2: Execute tools if needed (non-streaming)
      let toolResults: any[] = []
      let referenceNotes: string[] = []

      if (toolsNeeded.length > 0) {
        toolResults = await this.executeTools(toolsNeeded, input)

        // Extract note IDs
        const searchResult = toolResults.find((t) => t.tool === "search_notes")
        if (
          searchResult?.result?.notes &&
          Array.isArray(searchResult.result.notes)
        ) {
          referenceNotes = searchResult.result.notes.map((note: any) => note.id)
        }
      }

      // Handle conversational queries with streaming
      if (toolResults.length === 0) {
        const baseIntro =
          this.mode === AgentMode.PERSONA && this.activePersona
            ? `You are MindKeep AI, operating as "${this.activePersona.name}". ${this.activePersona.description}`
            : `You are MindKeep AI, a helpful assistant for managing personal notes.`

        const conversationPrompt = `${baseIntro}

Current message: "${input}"

Respond naturally and helpfully. Keep it brief (1-2 sentences).

IMPORTANT:
- **If user expresses INTENT to create/add/save a note WITHOUT providing content**, ask what they'd like to save
- Examples: "I need to create a note" → "I can create a note for you! What would you like the note to contain?"

Respond with ONLY the conversational text, no JSON.`

        // Stream the conversational response
        const stream = GeminiNanoService.promptStreamWithSession(
          this.sessionId!,
          conversationPrompt
        )

        let fullResponse = ""
        for await (const chunk of stream) {
          fullResponse += chunk
          yield { type: "chunk", data: chunk }
        }

        // Yield complete response
        yield {
          type: "complete",
          data: {
            extractedData: null,
            referenceNotes: [],
            aiResponse: fullResponse.trim(),
            dataType: "text",
            confidence: 1.0
          }
        }
        return
      }

      // For tool-based responses, use non-streaming (tool results need processing)
      // TODO: Can optimize this later to stream the final response
      const response = await this.generateResponse(
        input,
        toolResults,
        referenceNotes,
        this.sessionId
      )

      yield { type: "complete", data: response }
    } catch (error) {
      console.error("[Agent Stream] Error:", error)
      yield {
        type: "complete",
        data: {
          extractedData: null,
          referenceNotes: [],
          aiResponse: `I encountered an error: ${error.message}. Please try again.`
        }
      }
    }
  }

  /**
   * Determine which tools should be used for this query
   * History is automatically managed by the session
   */
  private async selectTools(
    query: string,
    sessionId: string
  ): Promise<Array<{ name: string; params: any }>> {
    console.log(` [Agent] selectTools called in ${this.mode} mode`)

    // Use Zod for reliable JSON parsing, which you're already using in your tools!
    const { z } = await import("zod")

    // Get available tools based on current mode
    const availableTools = this.getAvailableTools()
    const availableToolNames = availableTools.map((t) => t.name)

    console.log(" [Agent] Available tool names:", availableToolNames)

    // Step 1: Define the structured output we want from the LLM
    // In PERSONA mode, only allow search_notes and get_note
    // const toolEnum =
    // this.mode === AgentMode.PERSONA
    // ? z.enum(["search_notes", "get_note", "none"])
    // : z.enum([
    // "search_notes",
    // "get_note",
    // "list_categories",
    // "get_statistics",
    // "create_note_from_chat",
    // "none"
    // ])

    const toolEnum =
      this.mode === AgentMode.PERSONA
        ? ["search_notes", "get_note", "none"]
        : [
            "search_notes",
            "get_note",
            "list_categories",
            "get_statistics",
            "create_note_from_chat",
            "none"
          ]

    const ToolSelectionSchema = {
      tool: toolEnum,
      search_query: "string | null",
      note_id: "string | null",
      note_content: "string | null",
      note_title: "string | null",
      note_category: "string | null"
    }

    // const ToolSelectionSchema = z.object({
    // tool: toolEnum,
    // search_query: z
    // .string()
    // .nullable()
    // .optional()
    // .describe(
    // "A concise, keyword-focused search query if tool is 'search_notes'. Should not contain conversational filler."
    // ),
    // note_id: z
    // .string()
    // .nullable()
    // .optional()
    // .describe("The ID of the note if the tool is 'get_note'."),
    // note_content: z
    // .string()
    // .nullable()
    // .optional()
    // .describe(
    // "The content to save if tool is 'create_note_from_chat'. Extract from user message or use previous message context."
    // ),
    // note_title: z
    // .string()
    // .nullable()
    // .optional()
    // .describe(
    // "The title for the note if explicitly mentioned by user (e.g., 'add as note with title AWS')."
    // ),
    // note_category: z
    // .string()
    // .nullable()
    // .optional()
    // .describe(
    // "The category for the note if explicitly mentioned by user (e.g., 'add as note under aws category')."
    // )
    // })

    // Step 2: Create a more robust prompt (persona-aware)
    const toolDescriptions =
      this.mode === AgentMode.PERSONA
        ? `Available tools (PERSONA MODE - Search Only):
- search_notes: Find notes on a specific topic. Use this when user asks to FIND, RETRIEVE, SEARCH, or GET any information from their notes (passwords, emails, codes, etc.).
- get_note: Get a specific note by its ID. Use this ONLY when user explicitly mentions a note ID.
- none: For greetings (hi, hello, thanks) or if the request cannot be fulfilled with search.

NOTE: You are in PERSONA mode. You can ONLY search and read notes. You CANNOT create, update, delete, or organize notes.`
        : `Available tools:
- search_notes: Find notes on a specific topic. Use this when user asks to FIND, RETRIEVE, SEARCH, or GET any information from their notes (passwords, emails, codes, etc.).
- get_note: Get a specific note by its ID. Use this ONLY when user explicitly mentions a note ID.
- list_categories: List all available note categories. Use this when user asks about categories.
- get_statistics: Get comprehensive statistics about notes (total count, notes per category, dates). Use this when user asks "how many notes", "statistics", "note counts", "how many notes in each category", etc.
- create_note_from_chat: Create a NEW note from the conversation. Use when user wants to ADD, SAVE, CREATE, or MAKE a note. Keywords: "add note", "save note", "create note", "make note", "add this", "save this", "new note".
- none: ONLY for greetings (hi, hello, thanks) or meta questions about the conversation itself (what did we talk about?).`

    // Build OPTIMIZED conversation context for note creation detection
    // Use raw history for full content, but optimize for session to prevent token overflow
    let conversationContext = ""
    if (this.rawConversationHistory && this.rawConversationHistory.length > 0) {
      const recentHistory = buildOptimizedSessionHistory(
        this.rawConversationHistory,
        query,
        2000 // Limit context to 2000 tokens for tool selection
      )

      if (recentHistory.length > 0) {
        conversationContext =
          "\n\nRecent conversation:\n" +
          recentHistory
            .map(
              (msg) =>
                `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
            )
            .join("\n")
      }
    }

    const toolSelectionPrompt = `${toolDescriptions}

RULES:
- FIND/SEARCH/GET info → "search_notes" (optimize query: "my netflix password" → "netflix password")
- "How many notes" / "statistics" → "get_statistics"
- ADD/SAVE/CREATE note WITH actual content → "create_note_from_chat"
- "add THAT/THIS as note" → extract from PREVIOUS user message in conversation below
- Greetings/small talk → "none"
- **INTENT to create** (no actual content) → "none" (let conversational AI ask for content)

create_note_from_chat CRITICAL:
- ONLY use if there's ACTUAL content to save (either in query or in conversation context)
- If query is just "I want to create a note" or "I need to make a note" WITHOUT content → use "none"
- If query contains ONLY action words like "create note", "add note", "save note" with no actual information → use "none"
- note_content: FULL text from conversation or query, NO truncation/summary
- note_content should NEVER be the action phrase itself (e.g., don't save "create a note" as content)
- note_title: null (unless user says "with title X")
- note_category: null (unless user says "under X category")
${conversationContext}

Query: "${query}"

JSON schema:
{
 "tool": "tool_name",
 "search_query": "text", // for search_notes only
 "note_id": "id", // for get_note only
 "note_content": "COMPLETE FULL TEXT", // for create_note_from_chat - extract ALL content
 "note_title": null, // for create_note_from_chat
 "note_category": null // for create_note_from_chat
}

Examples:
- "find netflix password" → {"tool": "search_notes", "search_query": "netflix password"}
- "how many notes?" → {"tool": "get_statistics"}
- "hello" → {"tool": "none"}
- "I need to create a note" (NO content) → {"tool": "none"}
- "I want to add a note" (NO content) → {"tool": "none"}
- "create a new note" (NO content) → {"tool": "none"}
- "add note" (NO content) → {"tool": "none"}
- With context [User: "Password: abc123"] + "add that as note" → {"tool": "create_note_from_chat", "note_content": "Password: abc123", "note_title": null, "note_category": null}
- "The sky is blue - save as note" → {"tool": "create_note_from_chat", "note_content": "The sky is blue", "note_title": null, "note_category": null}
- "Meeting at 3pm with Sarah - add as note" → {"tool": "create_note_from_chat", "note_content": "Meeting at 3pm with Sarah", "note_title": null, "note_category": null}

Respond ONLY with JSON.`

    let responseText = "" // Declare outside try block for error handling

    try {
      // CRITICAL: Use one-off prompt (NO session history) for tool selection
      // Tool selection should be based ONLY on the current query, not conversation context
      // This prevents "Hi" from triggering searches due to previous conversation

      console.log(` [Agent] Tool selection for query: "${query}"`)
      console.log(" [Agent] Using executePrompt (no session history)")

      const response = await GeminiNanoService.promptWithSession(
        sessionId,
        toolSelectionPrompt,
        {
          responseConstraint: ToolSelectionSchema
        }
      )

      // Clean up potential markdown backticks AND malformed responses
      responseText = response
        .replace(/```json\s*/g, "")
        .replace(/```/g, "")
        .replace(/^[<>]+/g, "") // Remove leading < or > characters (Gemini Nano bug)
        .replace(/[<>]+$/g, "") // Remove trailing < or > characters
        .trim()

      console.log("[Agent] Raw tool selection JSON:", responseText)
      console.log("[Agent] JSON length:", responseText.length)

      // Step 3: Parse the structured response
      let parsed: any
      let toolName: string = "none" // Default fallback

      try {
        console.log("Raw response for parsing:", responseText)
        parsed = JSON.parse(responseText)
        console.log("[Agent] Parsed tool selection:", parsed)
        toolName = parsed.tool as string
      } catch (error) {
        console.error(
          "[Agent] Zod validation failed, falling back to 'none':",
          error
        )
        toolName = "none"
      }

      // Step 4: Convert the parsed object into the tool call format

      console.log(` [Agent] Selected tool: ${toolName}`)

      // In PERSONA mode, block non-search tools
      if (this.mode === AgentMode.PERSONA) {
        if (
          toolName !== "search_notes" &&
          toolName !== "get_note" &&
          toolName !== "none"
        ) {
          console.log(
            ` [Agent] Tool "${toolName}" not available in PERSONA mode`
          )
          return []
        }
      }

      switch (toolName) {
        case "search_notes":
          // CRITICAL: Use the optimized search_query, not the original user query!
          if (!parsed.search_query) {
            console.warn(
              "[Agent] 'search_notes' tool selected but no search_query was extracted. Falling back to original query."
            )
            return [
              { name: "search_notes", params: { query: query, limit: 5 } }
            ]
          }
          return [
            {
              name: "search_notes",
              params: { query: parsed.search_query, limit: 5 }
            }
          ]
        case "get_note":
          return [{ name: "get_note", params: { noteId: parsed.note_id } }]
        case "list_categories":
          if (this.mode === AgentMode.PERSONA) {
            console.log(
              ` [Agent] list_categories not available in PERSONA mode`
            )
            return []
          }
          return [{ name: "list_categories", params: {} }]
        case "get_statistics":
          if (this.mode === AgentMode.PERSONA) {
            console.log(` [Agent] get_statistics not available in PERSONA mode`)
            return []
          }
          return [{ name: "get_statistics", params: {} }]
        case "create_note_from_chat":
          if (this.mode === AgentMode.PERSONA) {
            console.log(
              ` [Agent] create_note_from_chat not available in PERSONA mode`
            )
            return []
          }
          return [
            {
              name: "create_note_from_chat",
              params: {
                content: parsed.note_content || this.lastUserMessage, // Use extracted content or fall back to last message
                title: parsed.note_title || undefined, // Convert null to undefined
                category: parsed.note_category || undefined, // Convert null to undefined
                skipClarification: false
              }
            }
          ]
        case "none":
        default:
          return []
      }
    } catch (error) {
      console.error("[Agent] Tool selection failed:", error)
      return []
    }
  }

  /**
   * Execute selected tools
   */
  private async executeTools(
    toolCalls: Array<{ name: string; params: any }>,
    query: string
  ): Promise<any[]> {
    const results: any[] = []
    const availableTools = this.getAvailableTools()

    for (const toolCall of toolCalls) {
      console.log(` [Agent] Executing tool: ${toolCall.name}`, toolCall.params)
      const tool = availableTools.find((t) => t.name === toolCall.name)

      if (!tool) {
        results.push({
          tool: toolCall.name,
          result: "Tool not found"
        })
        continue
      }

      try {
        if (this.verbose) {
          console.log(
            `[Agent] Executing tool: ${toolCall.name}`,
            toolCall.params
          )
        }

        // For create_note_from_chat, inject conversation history if content is missing
        let params = toolCall.params
        if (toolCall.name === "create_note_from_chat" && !params.content) {
          params = {
            ...params,
            _conversationHistory: this.conversationHistory
          }
        }

        const result = await tool.func(params)

        // Parse JSON string results to avoid double-encoding
        let parsedResult = result
        if (typeof result === "string") {
          try {
            parsedResult = JSON.parse(result)
          } catch (e) {
            // If not JSON, keep as string
            parsedResult = result
          }
        }

        results.push({
          tool: toolCall.name,
          result: parsedResult
        })
      } catch (error) {
        results.push({
          tool: toolCall.name,
          error: error.message
        })
      }
    }

    // **NEW: Optimize results before returning to prevent token overflow**
    // This applies smart content extraction and truncation to search results
    const optimizedResults = await this.optimizeToolResultsForLLM(
      results,
      query,
      4000 // Max tokens for Gemini Nano context
    )

    return optimizedResults
  }

  ExtractionSchema = z.object({
    extractedData: z
      .string()
      .nullable()
      .describe(
        "The specific data requested (e.g., a password, email, URL) or null if not found."
      ),
    dataType: z
      .enum(["email", "password", "url", "code", "text", "date", "other"])
      .describe("The type of data that was extracted."),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .describe(
        "A score from 0.0 to 1.0 indicating your confidence in the accuracy of the extracted data."
      ),
    aiResponse: z
      .string()
      .describe(
        "A brief, friendly, single-sentence response for the user explaining what was found or not found."
      ),
    sourceNoteIds: z
      .array(z.string())
      .describe(
        "Array of note IDs from which the answer was derived. Include ALL note IDs that contributed to the response."
      )
  })

  /**
   * Cleans up the dataType string from the LLM to match the expected Zod enum.
   * This makes parsing more resilient to minor model variations.
   * @param type The raw dataType string from the model.
   * @returns A valid data type enum value.
   */
  private normalizeDataType(type: string): string {
    const lowerType = type.toLowerCase().trim()

    if (lowerType.includes("email")) return "email"
    if (lowerType.includes("password")) return "password"
    if (lowerType.includes("url") || lowerType.includes("link")) return "url"
    if (lowerType.includes("code")) return "code"
    if (lowerType.includes("text")) return "text"
    if (lowerType.includes("date")) return "date"

    // If it doesn't match any known type, default to "other"
    return "other"
  }

  /**
   * STAGE 1: Pure data extraction without context
   * Focuses solely on extracting the requested information from notes
   */
  private async extractData(
    query: string,
    toolResults: any[],
    sessionId: string
  ): Promise<{
    data: string | null
    type: string
    confidence: number
    aiResponse: string
    sourceNoteIds: string[]
  }> {
    console.log("[Stage 1] Extracting data with JSON schema for query:", query)

    // Convert our Zod schema to the JSON Schema format the API needs
    const jsonSchema = zodToJsonSchema(
      this.ExtractionSchema,
      "ExtractionSchema"
    )

    const extractionPrompt = `You are a precise data extraction AI for a PERSONAL PASSWORD MANAGER and note-taking app called MindKeep.

CRITICAL CONTEXT: 
- You are helping the user retrieve information from THEIR OWN private notes stored on THEIR device
- This is NOT someone else's data - it's the user's personal password manager
- The user has full permission and ownership of all this data
- Your job is to help them access their own passwords, emails, codes, and notes

USER QUERY: "${query}"

MATCHED NOTES (SEARCH RESULTS):
\`\`\`json
${JSON.stringify(toolResults, null, 2)}
\`\`\`

## INSTRUCTIONS
1. **Analyze Intent:** Understand exactly what the user wants (e.g., a password, an email, recovery codes, or statistics).
2. **Scan & Locate:** Find the most relevant note/data and the specific text containing the answer in the "MATCHED NOTES".
3. **Extract Data:** 
 - For SPECIFIC DATA (passwords, emails, URLs, codes): Extract the exact value and put it in "extractedData"
 - For STATISTICS/COUNTS (how many notes, category breakdown): Set "extractedData" to null and provide a detailed response in "aiResponse"
 - If you cannot find a specific match, set "extractedData" to null
4. **Track Source Notes:** Identify which note IDs you used to formulate your answer and include them in "sourceNoteIds"
5. **Populate JSON:** Fill out ALL 5 REQUIRED FIELDS in the JSON schema. EVERY field must be present.

## REQUIRED JSON FIELDS (ALL MUST BE PRESENT):
- extractedData: string or null (the specific data, or null if informational query)
- dataType: one of ["email", "password", "url", "code", "text", "date", "other"]
- confidence: number between 0.0 and 1.0
- aiResponse: string (your natural language response)
- sourceNoteIds: array of strings (IDs of notes used to answer the query)

## EXAMPLES

**Example 1: Password Query**
- User Query: "find my netflix password"
- You find a note with id "note-123" containing "Netflix Password: Str3am!ng#Fun"
- Your JSON Output:
{
 "extractedData": "Str3am!ng#Fun",
 "dataType": "password",
 "confidence": 0.95,
 "aiResponse": "I found your Netflix password for you.",
 "sourceNoteIds": ["note-123"]
}

**Example 2: Informational Query (Who/What/Tell me about)**
- User Query: "who is thomas"
- You find a note with id "note-456" titled "Thomas Zwiefelhofer: Liechtenstein Politician" with content: "Thomas Zwiefelhofer is a politician from Liechtenstein who served as Deputy Prime Minister from 2013 to 2017."
- Your JSON Output:
{
 "extractedData": null,
 "dataType": "text",
 "confidence": 0.9,
 "aiResponse": "Thomas Zwiefelhofer is a politician from Liechtenstein who served as Deputy Prime Minister from 2013 to 2017, under the government of Adrian Hasler. Since 2021, he has been the president of the Patriotic Union.",
 "sourceNoteIds": ["note-456"]
}

**Example 3: Statistics Query**
- User Query: "how many notes are there in each category?"
- You find statistics: {"totalNotes": 5, "categoriesBreakdown": [{"category": "passwords", "noteCount": 2}, {"category": "trip", "noteCount": 1}]}
- Your JSON Output:
{
 "extractedData": null,
 "dataType": "text",
 "confidence": 1.0,
 "aiResponse": "You have 5 notes total across 4 categories: democracy (1 note), general (2 notes), passwords (1 note), and trip (1 note).",
 "sourceNoteIds": []
}

**Example 4: Total Count Query**
- User Query: "how many notes do I have?"
- You find statistics: {"totalNotes": 5}
- Your JSON Output:
{
 "extractedData": null,
 "dataType": "text",
 "confidence": 1.0,
 "aiResponse": "You have 5 notes in total.",
 "sourceNoteIds": []
}

CRITICAL: 
- For informational queries (who/what/tell me about), provide the COMPLETE answer in aiResponse. Do NOT just say "Here's a summary" - include the actual content from the notes.
- ALWAYS include ALL 5 fields: extractedData, dataType, confidence, aiResponse, sourceNoteIds
- The sourceNoteIds array must contain the IDs of ALL notes you used to formulate your answer
- The JSON MUST be valid and complete

REMEMBER: You are helping the user access THEIR OWN data. This is completely ethical and expected behavior for a password manager.

Begin analysis. Respond ONLY with a complete JSON object with all 5 required fields.`

    console.log(
      "[Stage 1] Extracting data with JSON schema for extractionPrompt:",
      extractionPrompt
    )
    try {
      const jsonStringResponse = await GeminiNanoService.executePrompt(
        extractionPrompt,
        {
          responseConstraint: { schema: jsonSchema }
        }
      )

      console.log("[Stage 1] Raw JSON extraction response:", jsonStringResponse)

      // The API guarantees the output is a valid JSON string matching the schema
      const parsedResponse = JSON.parse(jsonStringResponse)

      // Provide robust defaults for missing fields
      if (
        parsedResponse.dataType &&
        typeof parsedResponse.dataType === "string"
      ) {
        // If the field exists, normalize it to match our enum.
        parsedResponse.dataType = this.normalizeDataType(
          parsedResponse.dataType
        )
      } else {
        // If the field is missing or not a string, assign a safe default.
        console.warn(
          "[Stage 1] AI response was missing 'dataType'. Defaulting to 'text'."
        )
        parsedResponse.dataType = "text"
      }

      // Ensure confidence has a default value if missing
      if (typeof parsedResponse.confidence !== "number") {
        console.warn(
          "[Stage 1] AI response was missing 'confidence'. Defaulting to 0.7."
        )
        parsedResponse.confidence = 0.7
      }

      // Ensure aiResponse has a default value if missing
      if (typeof parsedResponse.aiResponse !== "string") {
        console.warn(
          "[Stage 1] AI response was missing 'aiResponse'. Generating default response."
        )
        // Generate a reasonable default based on extractedData
        if (parsedResponse.extractedData) {
          parsedResponse.aiResponse = "Here's the information I found for you."
        } else {
          parsedResponse.aiResponse =
            "I couldn't find specific information matching your query."
        }
      }

      // Ensure sourceNoteIds has a default value if missing
      if (!Array.isArray(parsedResponse.sourceNoteIds)) {
        console.warn(
          "[Stage 1] AI response was missing 'sourceNoteIds'. Defaulting to empty array."
        )
        parsedResponse.sourceNoteIds = []
      }

      // We can still validate with Zod for extra safety
      const validatedData = this.ExtractionSchema.parse(parsedResponse)

      console.log(
        "[Stage 1] Successfully extracted and validated data:",
        validatedData
      )

      return {
        data: validatedData.extractedData,
        type: validatedData.dataType,
        confidence: validatedData.confidence,
        aiResponse: validatedData.aiResponse,
        sourceNoteIds: validatedData.sourceNoteIds
      }
    } catch (error) {
      console.error("[Stage 1] Data extraction with JSON schema failed:", error)
      return {
        data: null,
        type: "other",
        confidence: 0.1,
        aiResponse: "I'm sorry, I had trouble processing that information.",
        sourceNoteIds: []
      }
    }
  }

  /**
   * STAGE 2: Format response with conversation context
   * Takes extracted data and creates a friendly conversational response
   */

  private async generateResponse(
    query: string,
    toolResults: any[],
    referenceNotes: string[],
    sessionId: string
  ): Promise<AgentResponse> {
    // STAGE 1: Extract precise data and get the AI-generated response text
    const extracted = await this.extractData(query, toolResults, sessionId)

    console.log(
      "[Stage 2] Generating final response from extracted data:",
      extracted
    )

    // Use sourceNoteIds from extraction, fallback to referenceNotes if empty
    const finalReferenceNotes =
      extracted.sourceNoteIds.length > 0
        ? extracted.sourceNoteIds
        : referenceNotes

    console.log(
      "[Stage 2] Final reference notes:",
      finalReferenceNotes,
      "| From extraction:",
      extracted.sourceNoteIds.length,
      "| From vector search:",
      referenceNotes.length
    )

    // STAGE 3: Apply persona transformation if in PERSONA mode
    let finalAiResponse = extracted.aiResponse
    if (this.mode === AgentMode.PERSONA && this.activePersona) {
      console.log(
        ` [Stage 3] Applying persona transformation for: ${this.activePersona.name}`
      )
      finalAiResponse = await this.applyPersonaTransformation(
        query,
        extracted,
        toolResults,
        sessionId
      )
    }

    // STAGE 2: Is now just assembling the final object. No more if/else logic!
    return {
      extractedData: extracted.data,
      referenceNotes: finalReferenceNotes,
      aiResponse: finalAiResponse, // Use persona-transformed response if applicable
      dataType: extracted.type as any,
      confidence: extracted.confidence,
      suggestedActions: this.generateActions(
        extracted.data,
        extracted.type,
        finalReferenceNotes
      )
    }
  }

  /**
   * STAGE 3: Apply persona transformation
   * Takes extracted data and transforms it according to the active persona's role
   */
  private async applyPersonaTransformation(
    query: string,
    extracted: {
      data: string | null
      type: string
      confidence: number
      aiResponse: string
      sourceNoteIds: string[]
    },
    toolResults: any[],
    sessionId: string
  ): Promise<string> {
    if (!this.activePersona) {
      return extracted.aiResponse
    }

    console.log(` [Persona Transform] Input query: "${query}"`)
    console.log(` [Persona Transform] Extracted data type: ${extracted.type}`)
    console.log(
      ` [Persona Transform] Source notes: ${extracted.sourceNoteIds.length}`
    )

    // Build persona transformation prompt
    const transformationPrompt = `You are MindKeep AI, operating as "${this.activePersona.name}".

=== YOUR ROLE ===
${this.activePersona.description}

=== PERSONA CONTEXT ===
${this.activePersona.context}

${
  this.activePersona.outputTemplate
    ? `=== OUTPUT TEMPLATE ===
${this.activePersona.outputTemplate}
`
    : ""
}

=== USER REQUEST ===
"${query}"

=== RETRIEVED DATA ===
The system found ${extracted.sourceNoteIds.length} relevant note(s):
\`\`\`json
${JSON.stringify(toolResults, null, 2)}
\`\`\`

=== YOUR TASK ===
Based on the user's request and the retrieved notes, generate a response that:
1. **Stays in character** as "${this.activePersona.name}"
2. **Uses the retrieved information** from the notes to fulfill the request
3. **Follows your output template** if one is provided
4. **Addresses the user directly** with the requested content

CRITICAL RULES:
- DO NOT just say "I found a note" - actually PRODUCE the content the user requested
- If the user asks you to write something, WRITE IT using the information from the notes
- If the user asks for a specific format (email, letter, summary), PROVIDE IT in that format
- Use ALL relevant information from the retrieved notes
- Stay completely in character as "${this.activePersona.name}"

${
  this.activePersona.outputTemplate
    ? `
REMEMBER: Follow your output template structure:
${this.activePersona.outputTemplate}
`
    : ""
}

Now generate your response:`

    console.log(
      ` [Persona Transform] Sending transformation prompt (${transformationPrompt.length} chars)`
    )

    try {
      const transformedResponse = await GeminiNanoService.promptWithSession(
        sessionId,
        transformationPrompt,
        {}
      )
      console.log(
        ` [Persona Transform] Received transformed response (${transformedResponse.length} chars)`
      )
      console.log(
        ` [Persona Transform] Preview: ${transformedResponse.substring(0, 200)}...`
      )
      return transformedResponse
    } catch (error) {
      console.error(" [Persona Transform] Failed to transform response:", error)
      // Fallback to original response
      return extracted.aiResponse
    }
  }

  /**
   * OLD METHOD - Keeping for reference/fallback
   */
  private async generateResponseOld(
    query: string,
    toolResults: any[],
    history: any[],
    referenceNotes: string[]
  ): Promise<AgentResponse> {
    // Create a natural conversational prompt
    let userMessage = query

    if (toolResults.length > 0) {
      try {
        userMessage = `## ROLE
You are a highly precise data extraction and summarization AI.

## GOAL
Your task is to analyze the user's query and the provided JSON search results to find a specific piece of information. You must then format your findings into a single, clean JSON object containing the extracted data, its type, a confidence score, and a natural language response.

## INPUTS

### 1. User Query:
"${query}"

### 2. Conversation History (for context):
- Use this to understand pronouns (it, that, the) or follow-up questions.
- Example: If the previous topic was "Netflix," and the new query is "what's the password?", you know to look for the Netflix password.

### 3. Search Results JSON:
\`\`\`json
${JSON.stringify(toolResults, null, 2)}
\`\`\`

## INSTRUCTIONS (Chain of Thought)

Follow these steps precisely:

1. **Analyze Intent:** Read the User Query and Conversation History to understand exactly what information the user wants (e.g., an email, a password for a specific service, recovery codes).

2. **Scan & Locate:** Search through the provided "Search Results JSON" to find the most relevant note and the specific text containing the answer. Prioritize direct matches.

3. **Extract Data:** Isolate the relevant data.
 * **For single values** (email, password, URL): Extract the one specific value.
 * **For multiple related values** (recovery codes, multiple codes): Extract ALL of them as a single string, separated by commas or newlines.
 * If you find it, this is your {extractedData}.
 * If you cannot find a specific match, set {extractedData} to null. DO NOT guess or return irrelevant data.

4. **Determine Data Type:** Classify the {extractedData} using one of the following exact values: "email", "password", "url", "text", "code", "date", "other".

5. **Calculate Confidence:** Assign a confidence score based on these rules:
 * '0.95': A direct, unambiguous match (e.g., the note says "Public email - sunny@example.com" and the query is for an email).
 * '0.90': A contextually strong match (e.g., the query is for "the password" after discussing Netflix, and you found a password in a note titled "Netflix").
 * '0.70': A possible but not definitive match.
 * '0.50': No specific data was found, but the notes provided might be relevant.

6. **Formulate AI Response:** Write a single, brief, friendly sentence for the {aiResponse} field explaining what you found or why you couldn't find it.

7. **Construct Final JSON:** Assemble the final JSON object in the required format. This is your ONLY output.

8. **Dont try to answer from prior conversation, use ONLY the provided Search Results. Previous conversation is only for your context. Just use as context lookup**

## OUTPUT FORMAT

You MUST respond with ONLY the JSON object in this exact format. Do not add any other text, explanations, or markdown formatting around it.

{
 "extractedData": "the specific data they asked for (email, password, etc.) or null",
 "dataType": "email|password|url|text|code|date|other",
 "confidence": <number>,
 "aiResponse": "A natural, friendly conversational message explaining what you found."
}

## EXAMPLES

- User asks for email: {"extractedData": "sunny@example.com", "dataType": "email", "confidence": 0.95, "aiResponse": "I found your public email address in your GitHub Profile settings note."}
- User asks "netflix password": {"extractedData": "Str3am!ng#Fun", "dataType": "password", "confidence": 0.95, "aiResponse": "I found your Netflix password for you."}
- User asks "twitter recovery codes": {"extractedData": "TWT-RXYZ-POST-ABCD, FEED-LMNO-ACCT-PQRS, NEWS-WXYZ-SAFE-1234", "dataType": "code", "confidence": 0.95, "aiResponse": "I found your Twitter recovery codes."}
- User asks "netflix recovery codes": {"extractedData": "SHOW-1212-FILM-3434, VIEW-5656-PASS-7878, CODE-9090-SAFE-1212", "dataType": "code", "confidence": 0.95, "aiResponse": "Here are your Netflix 2FA recovery codes."}
- After discussing Netflix, user asks "the password": {"extractedData": "Str3am!ng#Fun", "dataType": "password", "confidence": 0.9, "aiResponse": "Here is that Netflix password."}
- User asks for an email, but none is found: {"extractedData": null, "dataType": "other", "confidence": 0.5, "aiResponse": "I couldn't find a specific email address, but I did find a note about your GitHub profile settings that might help."}

Begin analysis.

IMPORTANT: Respond with ONLY the JSON object, nothing else.`
      } catch (error) {
        console.error("Failed to parse tool results:", error)
        userMessage = query
      }
    }

    // Enhanced prompt with JSON schema constraint
    const jsonPrompt = `${userMessage}

You MUST respond with a JSON object only with this structure:
{
 "extracted": "specific data extracted (email, password, URL, etc.)",
 "aiResponse": "helpful explanation to the user"
}

IMPORTANT Rules:
- Extract the specific data the user asked for
- Be precise and helpful in the aiResponse field
- ALWAYS use the fresh tool results provided, NOT previous answers
- Use conversation context to understand what the user is referring to`

    console.log(" Generating response with session:", this.sessionId)

    // Use promptWithSession with JSON constraint
    const responseText = await GeminiNanoService.promptWithSession(
      this.sessionId!,
      jsonPrompt,
      {
        responseConstraint: {
          type: "object",
          properties: {
            extracted: { type: "string" },
            aiResponse: { type: "string" }
          },
          required: ["extracted", "aiResponse"]
        }
      }
    )

    console.log("Model response:", responseText)

    // Parse the JSON response from the AI
    try {
      // Remove markdown code blocks if present
      let cleanedText = responseText
        .replace(/```json\s*/g, "")
        .replace(/```/g, "")
        .trim()

      // Extract JSON object
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0])

        return {
          extractedData: parsedResponse.extractedData || null,
          referenceNotes: referenceNotes,
          aiResponse: parsedResponse.aiResponse || responseText,
          dataType: parsedResponse.dataType || "other",
          confidence: parsedResponse.confidence || 0.5,
          suggestedActions: this.generateActions(
            parsedResponse.extractedData,
            parsedResponse.dataType,
            referenceNotes
          )
        }
      }
    } catch (error) {
      console.error("Failed to parse AI JSON response:", error)
    }

    // Fallback: if AI didn't return proper JSON, return generic response
    return {
      extractedData: null,
      referenceNotes: referenceNotes,
      aiResponse:
        responseText || "I'm sorry, I couldn't generate a proper response.",
      dataType: "other"
    }
  }

  /**
   * Generate suggested actions based on extracted data
   */
  private generateActions(
    extractedData: string | null,
    dataType: string | undefined,
    referenceNotes: string[]
  ): Array<{
    type: "copy" | "fill" | "view_note" | "open_link"
    label: string
    data: any
  }> {
    const actions: Array<{
      type: "copy" | "fill" | "view_note" | "open_link"
      label: string
      data: any
    }> = []

    if (extractedData) {
      // Add copy action for any extracted data
      actions.push({
        type: "copy",
        label: "Copy to clipboard",
        data: extractedData
      })

      // Add fill action for passwords/emails
      if (dataType === "password" || dataType === "email") {
        actions.push({
          type: "fill",
          label: `Fill ${dataType}`,
          data: extractedData
        })
      }

      // Add open link action for URLs
      if (dataType === "url") {
        actions.push({
          type: "open_link",
          label: "Open link",
          data: extractedData
        })
      }
    }

    // Add view note actions
    referenceNotes.forEach((noteId, index) => {
      actions.push({
        type: "view_note",
        label: `View note ${index + 1}`,
        data: noteId
      })
    })

    return actions
  }

  /**
   * Clear conversation history by recreating the session
   */
  async clearHistory(): Promise<void> {
    if (this.sessionId) {
      await GeminiNanoService.destroySession(this.sessionId)
      this.sessionId = await GeminiNanoService.createSession({
        systemPrompt: this.buildSystemPrompt(),
        temperature: this.temperature,
        topK: this.topK
      })
      if (this.verbose) {
        console.log(" [Agent] Conversation history cleared")
      }
    }
  }

  /**
   * Get the last user message content
   * Useful for note creation from chat context
   */
  getLastUserMessage(): string {
    return this.lastUserMessage
  }

  /**
   * Get session metadata (usage stats, etc.)
   */
  getSessionInfo(): SessionMetadata | null {
    if (!this.sessionId) return null
    return GeminiNanoService.getSessionMetadata(this.sessionId)
  }

  /**
   * Get a human-readable summary of session info
   */
  getHistorySummary(): string {
    if (!this.sessionId) {
      return "No active session."
    }

    const metadata = GeminiNanoService.getSessionMetadata(this.sessionId)
    if (!metadata) {
      return "No session metadata available."
    }

    return ` Session Info:
- Created: ${metadata.createdAt.toLocaleString()}
- Last used: ${metadata.lastUsedAt.toLocaleString()}
- Token usage: ${metadata.inputUsage}/${metadata.inputQuota}
- Mode: ${this.mode}
${this.activePersona ? `- Active persona: ${this.activePersona.name}` : ""}`
  }

  /**
   * Generate clarification options for note creation
   * @param clarificationData Data from the tool indicating what clarification is needed
   */
  private async generateClarificationOptions(
    clarificationData: any
  ): Promise<AgentResponse["clarificationOptions"]> {
    const options: AgentResponse["clarificationOptions"] = []

    const clarificationType = clarificationData.clarificationType
    const existingCategories = clarificationData.existingCategories || []
    const noteContent = clarificationData.noteContent || ""

    console.log("[Agent] generateClarificationOptions called with:", {
      clarificationType,
      existingCategoriesCount: existingCategories.length,
      hasContent: !!noteContent
    })

    // Import AI service functions
    const { generateTitle, generateCategory, getRelevantCategories } =
      await import("./ai-service")

    // If both are missing, show only high-level options (simplified flow)
    if (clarificationType === "both") {
      console.log("[Agent] Showing simplified 'both' options")
      options.push({
        type: "button",
        label: " Auto-generate Both",
        value: "auto_both",
        action: "auto_generate_both"
      })
      options.push({
        type: "button",
        label: "I'll choose manually",
        value: "manual_flow",
        action: "start_manual_flow"
      })
      options.push({
        type: "button",
        label: " Cancel",
        value: "cancel",
        action: "cancel_note_creation"
      })

      // Return early - don't show individual title/category options yet
      return options
    }

    // Handle title clarification (when only title is missing)
    if (clarificationType === "title") {
      options.push({
        type: "button",
        label: "Auto-generate Title",
        value: "auto",
        action: "auto_generate_title"
      })
      options.push({
        type: "button",
        label: "I'll provide a title",
        value: "manual",
        action: "manual_title"
      })
      options.push({
        type: "button",
        label: " Cancel",
        value: "cancel",
        action: "cancel_note_creation"
      })
    }

    // Handle category clarification (when only category is missing)
    if (clarificationType === "category") {
      // If we have existing categories, get relevant ones using semantic similarity
      if (existingCategories.length > 0 && noteContent) {
        try {
          const relevantCategories = await getRelevantCategories(
            "",
            noteContent,
            existingCategories
          )

          // Show top 5 most relevant categories as pills
          relevantCategories.slice(0, 5).forEach((cat) => {
            options.push({
              type: "category_pill",
              label: cat.category,
              value: cat.category,
              action: "select_category"
            })
          })
        } catch (error) {
          console.error("[Agent] Error getting relevant categories:", error)
        }
      }

      // Always add option to auto-generate new category
      options.push({
        type: "button",
        label: "Auto-generate New Category",
        value: "auto",
        action: "auto_generate_category"
      })

      // Option to manually enter
      options.push({
        type: "button",
        label: "I'll provide a category",
        value: "manual",
        action: "manual_category"
      })

      // Always add cancel option
      options.push({
        type: "button",
        label: " Cancel",
        value: "cancel",
        action: "cancel_note_creation"
      })
    }

    return options
  }
}

// ============================================================================
// AGENT FACTORY
// ============================================================================

/**
 * Create a new MindKeep agent instance
 * Note: You must call agent.initialize() after creation
 */
export async function createAgent(
  config: Partial<AgentConfig> = {}
): Promise<MindKeepAgent> {
  const agent = new MindKeepAgent(config)
  await agent.initialize() // Initialize session
  return agent
}

/**
 * Singleton agent for the entire application
 */
let globalAgent: MindKeepAgent | null = null

/**
 * Get or create the global agent instance
 */
export async function getGlobalAgent(): Promise<MindKeepAgent> {
  if (!globalAgent) {
    globalAgent = await createAgent({ verbose: true })
  }
  return globalAgent
}

/**
 * Reset the global agent (useful for testing)
 */
export function resetGlobalAgent(): void {
  globalAgent = null
}
