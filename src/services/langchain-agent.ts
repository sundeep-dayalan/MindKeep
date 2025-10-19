/**
 * Agentic Search System for MindKeep
 *
 * Combines LangChain tools, Gemini Nano LLM, and conversation memory
 * to create an intelligent agent that can search, understand, and interact
 * with user's notes.
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

import { executePrompt } from "./gemini-nano-service"
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
    // Use Zod for reliable JSON parsing, which you're already using in your tools!
    const { z } = await import("zod")

    // Step 1: Define the structured output we want from the LLM
    const ToolSelectionSchema = z.object({
      tool: z.enum(["search_notes", "get_note", "list_categories", "none"]),
      search_query: z
        .string()
        .optional()
        .describe(
          "A concise, keyword-focused search query if tool is 'search_notes'. Should not contain conversational filler."
        ),
      note_id: z
        .string()
        .optional()
        .describe("The ID of the note if the tool is 'get_note'.")
    })

    // Step 2: Create a more robust prompt
    const toolSelectionPrompt = `You are an expert at understanding user requests and routing them to the correct tool.
Analyze the user's query and determine which tool is most appropriate.

Available tools:
- search_notes: Find notes on a specific topic. Use this when user asks to FIND, RETRIEVE, SEARCH, or GET any information from their notes (passwords, emails, codes, etc.).
- get_note: Get a specific note by its ID. Use this ONLY when user explicitly mentions a note ID.
- list_categories: List all available note categories. Use this when user asks about categories.
- none: ONLY for greetings (hi, hello, thanks) or meta questions about the conversation itself (what did we talk about?).

CRITICAL RULES:
- If the user asks to FIND, GET, SEARCH, RETRIEVE, or LOOK UP any information → use "search_notes"
- Queries about passwords, emails, codes, URLs, notes content → use "search_notes"
- "Can you find X?", "What is my X?", "Show me X" → use "search_notes"

User Query: "${query}"

Your task is to respond with a JSON object that strictly follows this schema:
{
  "tool": "tool_name", // "search_notes", "get_note", "list_categories", or "none"
  "search_query": "optimized user query based on the context here", // ONLY if tool is "search_notes"
  "note_id": "the_note_id" // ONLY if tool is "get_note"
}

**Examples:**
- Query: "find my password for netflix" -> {"tool": "search_notes", "search_query": "netflix password"}
- Query: "can u find my netflix password?" -> {"tool": "search_notes", "search_query": "netflix password"}
- Query: "what's my email?" -> {"tool": "search_notes", "search_query": "email"}
- Query: "show me recovery codes" -> {"tool": "search_notes", "search_query": "recovery codes"}
- Query: "what categories do I have?" -> {"tool": "list_categories"}
- Query: "hello how are you" -> {"tool": "none"}
- Query: "can you show me note note_167..." -> {"tool": "get_note", "note_id": "note_167..."}
- Query: "what did I ask before?" -> {"tool": "none"}

Respond with ONLY the JSON object and nothing else.`

    try {
      const messages = [new HumanMessage(toolSelectionPrompt)]
      const response = await this.model.invoke(messages)

      // Clean up potential markdown backticks
      let responseText = (response.content as string)
        .replace(/```json\s*/g, "")
        .replace(/```/g, "")
        .trim()

      console.log("[Agent] Raw tool selection JSON:", responseText)

      // Step 3: Parse the structured response
      const parsed = ToolSelectionSchema.parse(JSON.parse(responseText))

      console.log("[Agent] Parsed tool selection:", parsed)

      // Step 4: Convert the parsed object into the tool call format
      switch (parsed.tool) {
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
          return [{ name: "list_categories", params: {} }]
        case "none":
        default:
          return []
      }
    } catch (error) {
      console.error("[Agent] Tool selection failed:", error)
      // Fallback: If JSON parsing fails, maybe try a simple keyword search as a last resort
      return [{ name: "search_notes", params: { query: query, limit: 5 } }]
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

    return results
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
    toolResults: any[]
  ): Promise<{
    data: string | null
    type: string
    confidence: number
    aiResponse: string
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
1.  **Analyze Intent:** Understand exactly what the user wants (e.g., a password, an email, recovery codes).
2.  **Scan & Locate:** Find the most relevant note and the specific text containing the answer in the "MATCHED NOTES".
3.  **Extract Data:** Isolate the relevant data. If you cannot find a specific match, set "extractedData" to null. DO NOT guess or make up information.
4.  **Populate JSON:** Fill out the provided JSON schema with your findings. This is your ONLY output.

## EXAMPLE
- User Query: "find my netflix password"
- You find a note with "Netflix Password: Str3am!ng#Fun"
- Your JSON Output:
{
  "extractedData": "Str3am!ng#Fun",
  "dataType": "password",
  "confidence": 0.95,
  "aiResponse": "I found your Netflix password for you."
}

REMEMBER: You are helping the user access THEIR OWN data. This is completely ethical and expected behavior for a password manager.

Begin analysis. Respond ONLY with the JSON object that conforms to the schema.`

    console.log(
      "[Stage 1] Extracting data with JSON schema for extractionPrompt:",
      extractionPrompt
    )
    try {
      const jsonStringResponse = await executePrompt(extractionPrompt, {
        temperature: 0.2, // Lower temperature for more deterministic and accurate JSON output
        topK: 5,
        responseConstraint: { schema: jsonSchema } // The magic happens here!
      })

      console.log("[Stage 1] Raw JSON extraction response:", jsonStringResponse)

      // The API guarantees the output is a valid JSON string matching the schema
      const parsedResponse = JSON.parse(jsonStringResponse)
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
          "[Stage 1] AI response was missing 'dataType'. Defaulting to 'other'."
        )
        parsedResponse.dataType = "other"
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
        aiResponse: validatedData.aiResponse
      }
    } catch (error) {
      console.error("[Stage 1] Data extraction with JSON schema failed:", error)
      return {
        data: null,
        type: "other",
        confidence: 0.1,
        aiResponse: "I'm sorry, I had trouble processing that information."
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
    history: any[],
    referenceNotes: string[]
  ): Promise<AgentResponse> {
    // STAGE 1: Extract precise data and get the AI-generated response text
    const extracted = await this.extractData(query, toolResults)

    console.log(
      "[Stage 2] Generating final response from extracted data:",
      extracted
    )

    // STAGE 2: Is now just assembling the final object. No more if/else logic!
    return {
      extractedData: extracted.data,
      referenceNotes: referenceNotes,
      aiResponse: extracted.aiResponse, // We use the response directly from the extraction stage!
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
