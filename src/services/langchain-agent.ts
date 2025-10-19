/**
 * Agentic Search System for MindKeep
 *
 * Combines LangChain tools, Gemini Nano LLM, and conversation memory
 * to create an intelligent agent that can search, understand, and interact
 * with user's notes.
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages"

import { GeminiNanoChat } from "./langchain-gemini-nano"
import { ConversationBuffer } from "./langchain-memory"
import { allTools, readOnlyTools } from "./langchain-tools"

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
}

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

const AGENT_SYSTEM_PROMPT = `You are MindKeep AI, a helpful assistant that helps users search and manage their personal notes.

You have access to these tools:
- search_notes: Search through notes using semantic similarity
- get_note: Retrieve a specific note by ID
- create_note: Create a new note
- update_note: Update an existing note
- delete_note: Delete a note
- list_categories: List all note categories

When helping users:
1. Understand their intent clearly
2. Use appropriate tools to fetch information
3. Provide clear, concise answers based on the results
4. Always cite which notes you're referencing
5. If you can't find information, say so clearly

Important:
- Be conversational and friendly
- Keep responses concise (2-3 sentences when possible)
- Always protect user privacy - all data stays on their device
- If a tool returns an error, explain it to the user helpfully`

// ============================================================================
// SIMPLE AGENT (ReAct-style without external dependencies)
// ============================================================================

export interface AgentConfig {
  model?: GeminiNanoChat
  tools?: typeof allTools
  memory?: ConversationBuffer
  maxIterations?: number
  verbose?: boolean
}

export class MindKeepAgent {
  private model: GeminiNanoChat
  private tools: typeof allTools
  private memory: ConversationBuffer
  private maxIterations: number
  private verbose: boolean

  constructor(config: AgentConfig = {}) {
    this.model = config.model!
    this.tools = config.tools || readOnlyTools
    this.memory = config.memory || new ConversationBuffer(10)
    this.maxIterations = config.maxIterations || 5
    this.verbose = config.verbose || false
  }

  /**
   * Process a user query through the agent
   * Returns structured response with extracted data + AI message
   */
  async run(input: string): Promise<AgentResponse> {
    if (this.verbose) {
      console.log(`\n🤖 [Agent] Processing query: "${input}"`)
      const currentHistory = this.memory.getMessages()
      console.log(
        `📚 [Agent] Conversation history: ${currentHistory.length} messages`
      )
    }

    // Handle special debug commands
    if (input.toLowerCase() === "/history") {
      return {
        extractedData: null,
        referenceNotes: [],
        aiResponse: this.getHistorySummary()
      }
    }
    if (input.toLowerCase() === "/clear") {
      this.clearMemory()
      return {
        extractedData: null,
        referenceNotes: [],
        aiResponse: "✅ Conversation history cleared. Starting fresh!"
      }
    }

    try {
      // Load conversation history
      const { history } = await this.memory.loadMemoryVariables({})

      // Step 1: Determine which tools to use (if any)
      const toolsNeeded = await this.selectTools(input, history)

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
            // if (toolResults[0].notes && Array.isArray(toolResults[0].notes)) {
            //   referenceNotes = toolResults[0].notes.map((note: any) => note.id)
            // }
          }
        } catch (e) {
          console.warn("Could not extract note IDs from tool results")
        }

        if (this.verbose) {
          console.log(`[Agent] Tool results:`, toolResults)
          console.log(`[Agent] Reference notes:`, referenceNotes)
        }
      }

      console.log("Tool Results:", toolResults)

      // Step 3: Generate structured response
      const response = await this.generateResponse(
        input,
        toolResults,
        history,
        referenceNotes
      )

      // Step 4: Save to memory (only save the AI response text)
      await this.memory.saveContext({ input }, { output: response.aiResponse })
      console.log(
        "Saved to memory:",
        { input },
        { output: response.aiResponse }
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
   * Determine which tools should be used for this query
   */
  private async selectTools(
    query: string,
    history: any[]
  ): Promise<Array<{ name: string; params: any }>> {
    // For conversational queries that reference history, skip tool selection
    const conversationalPatterns = [
      /what (was|is) my (last|previous|first)/i,
      /what did i (just )?(ask|say|tell)/i,
      /can you (list|show|tell).*(questions|asked)/i,
      /do you remember/i
    ]

    if (conversationalPatterns.some((pattern) => pattern.test(query))) {
      console.log("[Agent] Conversational query detected, skipping tools")
      return []
    }

    const toolSelectionPrompt = `Analyze this query and determine if it needs to search the user's notes database.

Available tools:
${this.tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

Query: "${query}"

Rules:
- If the query is in the context of user is searching for notes or finding some information from notes or category, then only → Use search_notes
- If the query is conversational (greetings, questions about conversation, general chat) → No tools needed
- If asking for a specific note by ID → Use get_note

Respond with ONE of:
1. "search_notes" (if user is searching/trying to find info on "Can you find my login credentials of netflix" then use search_notes)
2. "get_note:123" (if retrieving note with ID 123)
3. "none" (if it's just conversation)

Examples:
- "find my password notes" → search_notes
- "what was my last question?" → none
- "hello" → none
- "show me notes about work" → search_notes`

    try {
      const messages = [
        new SystemMessage(toolSelectionPrompt),
        new HumanMessage(query)
      ]

      const response = await this.model.invoke(messages)

      console.log("[Agent] Tool selection response:", response)

      // Extract text content from AIMessage
      let responseText = ""
      if (typeof response === "string") {
        responseText = response
      } else if (response.content) {
        // Handle both string content and array content
        if (typeof response.content === "string") {
          responseText = response.content
        } else if (Array.isArray(response.content)) {
          // If content is an array, join all text parts
          responseText = response.content
            .map((part) => (typeof part === "string" ? part : part.text || ""))
            .join("")
        }
      }

      console.log("[Agent] Tool selection response:", responseText)

      if (!responseText || responseText.trim() === "") {
        console.warn(
          "[Agent] Empty response from model, skipping tool selection"
        )
        return []
      }

      // Parse the new format: "tool_name:parameter" or "none"
      const cleanResponse = responseText.toLowerCase().trim()

      // Check if no tools needed
      if (
        cleanResponse === "none" ||
        cleanResponse.includes("no tools") ||
        cleanResponse.includes("conversation")
      ) {
        console.log("[Agent] No tools needed for this query")
        return []
      }

      // Parse tool:parameter format
      const toolMatch = cleanResponse.match(
        /^(search_notes|get_note|list_categories):(.+)$/
      )
      if (toolMatch) {
        const [, toolName, param] = toolMatch

        if (toolName === "search_notes") {
          return [
            { name: "search_notes", params: { query: param.trim(), limit: 5 } }
          ]
        } else if (toolName === "get_note") {
          return [{ name: "get_note", params: { noteId: param.trim() } }]
        } else if (toolName === "list_categories") {
          return [{ name: "list_categories", params: {} }]
        }
      }

      // Fallback: if response contains tool name, try to extract it
      if (cleanResponse.includes("search_notes")) {
        // Extract search term after "search_notes"
        const searchMatch = responseText.match(/search_notes/i)
        if (searchMatch) {
          return [
            {
              name: "search_notes",
              params: { query: query, limit: 5 }
            }
          ]
        }
      }

      console.log(
        "[Agent] Could not parse tool selection, assuming no tools needed"
      )
      return []
    } catch (error) {
      console.error("[Agent] Tool selection error:", error)
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

    for (const toolCall of toolCalls) {
      console.log(`[Agent] Executing tool: ${toolCall.name}`, toolCall.params)
      const tool = this.tools.find((t) => t.name === toolCall.name)

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

        const result = await tool.func(toolCall.params)
        results.push({
          tool: toolCall.name,
          result: result
        })
      } catch (error) {
        results.push({
          tool: toolCall.name,
          error: error.message
        })
      }
    }

    return results
  }

  /**
   * STAGE 1: Pure data extraction without context
   * Focuses solely on extracting the requested information from notes
   */
  private async extractData(
    query: string,
    toolResults: any[]
  ): Promise<{ data: string | null; type: string; confidence: number }> {
    console.log(
      "[Stage 1] Extracting data for query:",
      query,
      "from tool results:",
      toolResults
    )
    const extractionPrompt = `You are a precise data extraction AI.

USER QUERY: "${query}"

MATCHED NOTES:
\`\`\`json
${JSON.stringify(toolResults, null, 2)}
\`\`\`

TASK: Extract ONLY the specific data the user asked for.

RULES:
1. For single values (email, password, username): Return the exact value
2. For multiple values (recovery codes): Return ALL of them, comma-separated
3. If not found: Return null
4. DO NOT add explanations or conversational text
5. Return ONLY the raw data

EXAMPLES:
- Query "twitter recovery codes" → "TWT-RXYZ-POST-ABCD, FEED-LMNO-ACCT-PQRS, NEWS-WXYZ-SAFE-1234"
- Query "netflix password" → "Str3am!ng#Fun"
- Query "my email" → "sunny@example.com"
- Query "not found" → "null"

Respond with ONLY the extracted data, nothing else:`

    console.log("Prompt for extraction:", extractionPrompt)
    try {
      // Use gemini-nano-service directly for pure extraction
      const { executePrompt } = await import("./gemini-nano-service")
      const rawData = await executePrompt(extractionPrompt, {
        temperature: 0.3, // Lower temperature for precise extraction
        topK: 10
      })

      const trimmedData = rawData.trim()

      // Determine data type from query
      let dataType = "other"
      const queryLower = query.toLowerCase()
      if (queryLower.includes("email")) dataType = "email"
      else if (queryLower.includes("password")) dataType = "password"
      else if (queryLower.includes("recovery") || queryLower.includes("code"))
        dataType = "code"
      else if (
        queryLower.includes("url") ||
        queryLower.includes("link") ||
        queryLower.includes("website")
      )
        dataType = "url"

      // Calculate confidence based on data quality
      let confidence = 0.5
      if (trimmedData && trimmedData !== "null" && trimmedData.length > 0) {
        confidence = 0.95 // High confidence if we extracted something
      }

      return {
        data: trimmedData === "null" ? null : trimmedData,
        type: dataType,
        confidence
      }
    } catch (error) {
      console.error("[Stage 1] Data extraction failed:", error)
      return { data: null, type: "other", confidence: 0.5 }
    }
  }

  /**
   * STAGE 2: Format response with conversation context
   * Takes extracted data and creates a friendly conversational response
   */
  private async generateResponse(
    query: string,
    toolResults: any[],
    history: any[],
    referenceNotes: string[]
  ): Promise<AgentResponse> {
    // STAGE 1: Extract precise data without context
    const extracted = await this.extractData(query, toolResults)

    console.log("[Stage 1] Extracted data:", extracted)

    // STAGE 2: Generate friendly AI response with context
    let aiResponse = ""

    if (extracted.data) {
      // Determine service name from query or history
      const queryLower = query.toLowerCase()
      let serviceName = "your"

      // Extract service name from query
      const servicePatterns = [
        "netflix",
        "twitter",
        "x",
        "google",
        "amazon",
        "microsoft",
        "aws",
        "chase",
        "linkedin",
        "dropbox",
        "epic",
        "github"
      ]
      for (const service of servicePatterns) {
        if (queryLower.includes(service)) {
          serviceName = service.charAt(0).toUpperCase() + service.slice(1)
          break
        }
      }

      // Generate response based on data type
      if (extracted.type === "code") {
        aiResponse = `Here are your ${serviceName} recovery codes.`
      } else if (extracted.type === "password") {
        aiResponse = `I found your ${serviceName} password.`
      } else if (extracted.type === "email") {
        aiResponse = `I found your email address.`
      } else if (extracted.type === "url") {
        aiResponse = `Here's the link you requested.`
      } else {
        aiResponse = `I found the information you were looking for.`
      }
    } else {
      // No data found
      aiResponse = "I couldn't find that specific information in your notes."
    }

    return {
      extractedData: extracted.data,
      referenceNotes: referenceNotes,
      aiResponse: aiResponse,
      dataType: extracted.type as any,
      confidence: extracted.confidence,
      suggestedActions: this.generateActions(
        extracted.data,
        extracted.type,
        referenceNotes
      )
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

1.  **Analyze Intent:** Read the User Query and Conversation History to understand exactly what information the user wants (e.g., an email, a password for a specific service, recovery codes).

2.  **Scan & Locate:** Search through the provided "Search Results JSON" to find the most relevant note and the specific text containing the answer. Prioritize direct matches.

3.  **Extract Data:** Isolate the relevant data.
    * **For single values** (email, password, URL): Extract the one specific value.
    * **For multiple related values** (recovery codes, multiple codes): Extract ALL of them as a single string, separated by commas or newlines.
    * If you find it, this is your {extractedData}.
    * If you cannot find a specific match, set {extractedData} to null. DO NOT guess or return irrelevant data.

4.  **Determine Data Type:** Classify the {extractedData} using one of the following exact values: "email", "password", "url", "text", "code", "date", "other".

5.  **Calculate Confidence:** Assign a confidence score based on these rules:
    * '0.95': A direct, unambiguous match (e.g., the note says "Public email - sunny@example.com" and the query is for an email).
    * '0.90': A contextually strong match (e.g., the query is for "the password" after discussing Netflix, and you found a password in a note titled "Netflix").
    * '0.70': A possible but not definitive match.
    * '0.50': No specific data was found, but the notes provided might be relevant.

6.  **Formulate AI Response:** Write a single, brief, friendly sentence for the {aiResponse} field explaining what you found or why you couldn't find it.

7.  **Construct Final JSON:** Assemble the final JSON object in the required format. This is your ONLY output.

8.  **Dont try to answer from prior conversation, use ONLY the provided Search Results. Previous conversation is only for your context. Just use as context lookup**

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

    // Enhanced system prompt
    const systemPrompt =
      AGENT_SYSTEM_PROMPT +
      "\n\nIMPORTANT Rules:" +
      "\n- You MUST respond with a JSON object only" +
      "\n- Extract the specific data the user asked for (email, password, URL, etc.)" +
      "\n- Be precise and helpful in the aiResponse field" +
      "\n- ALWAYS use the fresh tool results provided, NOT previous answers" +
      "\n- Use conversation context to understand what the user is referring to (e.g., 'the password' after asking about Netflix means Netflix password)"

    // Include LIMITED history (last 2 exchanges) to maintain context
    // but prioritize fresh tool results over old answers
    let contextHistory: any[] = []
    if (history.length > 0) {
      // Include only the last 2 user-AI exchanges (4 messages max)
      const recentHistory = history.slice(-4)
      contextHistory = recentHistory
    }

    const messages = [
      new SystemMessage(systemPrompt),
      ...contextHistory,
      new HumanMessage(userMessage)
    ]

    console.log(
      "Messages for response generation:",
      JSON.stringify(messages, null, 2)
    )

    const response = await this.model.invoke(messages)

    console.log("Model response:", JSON.stringify(response, null, 2))

    let responseText = ""
    if (typeof response.content === "string") {
      responseText = response.content
    } else {
      responseText = String(response.content)
    }

    // Parse the JSON response from the AI
    try {
      // Remove markdown code blocks if present
      responseText = responseText
        .replace(/```json\s*/g, "")
        .replace(/```/g, "")
        .trim()

      // Extract JSON object
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
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
   * Stream response for real-time UI updates
   */
  async *runStreaming(input: string): AsyncGenerator<string> {
    if (this.verbose) {
      console.log(`\n[Agent] Streaming query: "${input}"\n`)
    }

    try {
      // Load conversation history
      const { history } = await this.memory.loadMemoryVariables({})

      // Step 1: Determine which tools to use
      const toolsNeeded = await this.selectTools(input, history)

      // Step 2: Execute tools if needed
      let toolResults: any[] = []
      if (toolsNeeded.length > 0) {
        yield `🔍 Searching your notes...\n\n`
        toolResults = await this.executeTools(toolsNeeded, input)
      }

      // Step 3: Stream the response
      const messages = [
        new SystemMessage(AGENT_SYSTEM_PROMPT),
        ...history,
        new HumanMessage(
          toolResults.length > 0
            ? `User query: "${input}"\n\nTool results:\n${JSON.stringify(toolResults, null, 2)}\n\nBased on these results, provide a helpful response to the user.`
            : input
        )
      ]

      let fullResponse = ""
      for await (const chunk of await this.model.stream(messages)) {
        const content = chunk.content as string
        fullResponse += content
        yield content
      }

      // Save to memory
      await this.memory.saveContext({ input }, { output: fullResponse })
    } catch (error) {
      console.error("[Agent] Streaming error:", error)
      yield `\n\nI encountered an error: ${error.message}`
    }
  }

  /**
   * Clear conversation memory
   */
  clearMemory(): void {
    this.memory.clear()
    if (this.verbose) {
      console.log("🗑️ [Agent] Conversation memory cleared")
    }
  }

  /**
   * Get conversation history
   */
  getHistory(): any[] {
    return this.memory.getMessages()
  }

  /**
   * Get a human-readable summary of conversation history
   */
  getHistorySummary(): string {
    const messages = this.memory.getMessages()
    if (messages.length === 0) {
      return "No conversation history yet."
    }

    return messages
      .map((msg, idx) => {
        const role = msg._getType() === "human" ? "User" : "AI"
        const content =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content)
        return `${idx + 1}. ${role}: ${content.substring(0, 100)}...`
      })
      .join("\n")
  }
}

// ============================================================================
// AGENT FACTORY
// ============================================================================

/**
 * Create a new MindKeep agent instance
 */
export async function createAgent(
  config: Partial<AgentConfig> = {}
): Promise<MindKeepAgent> {
  // Create or use provided model
  let model = config.model
  if (!model) {
    const availability = await GeminiNanoChat.checkAvailability()
    if (!availability.available) {
      throw new Error(`Gemini Nano not available: ${availability.message}`)
    }
    model = new GeminiNanoChat({
      temperature: 0.7,
      topK: 40
    })
  }

  return new MindKeepAgent({
    ...config,
    model
  })
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
