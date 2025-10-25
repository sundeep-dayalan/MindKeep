import React from "react"

import { MarkdownRenderer } from "~components/MarkdownRenderer"
import { PersonaSelector } from "~components/PersonaSelector"
import {
  RichTextEditor,
  type RichTextEditorRef
} from "~components/RichTextEditor"
import type { Note } from "~services/db-service"
import type { AgentResponse } from "~services/langchain-agent"
import { getGlobalAgent } from "~services/langchain-agent"
import type { Persona } from "~types/persona"
import { tiptapToMarkdown } from "~util/tiptap-to-markdown"

// Helper function to get dynamic greeting based on time of day
function getTimeBasedGreeting(): string {
  const hour = new Date().getHours()

  if (hour >= 5 && hour < 12) {
    return "Good morning"
  } else if (hour >= 12 && hour < 17) {
    return "Good afternoon"
  } else if (hour >= 17 && hour < 21) {
    return "Good evening"
  } else {
    return "Good night"
  }
}

interface Message {
  id: string
  type: "user" | "ai"
  content: string
  timestamp: number
  clarificationOptions?: AgentResponse["clarificationOptions"]
  pendingNoteData?: AgentResponse["pendingNoteData"]
  referenceNotes?: Note[] // Full note objects for display
}

interface AISearchBarProps {
  placeholder?: string
  onSearch?: (
    query: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ) => Promise<string | AgentResponse>
  onNoteCreated?: () => void // Callback when a note is successfully created
  onNotesChange?: () => Promise<void> // Callback when notes are modified (e.g., category changed)
  onMessagesChange?: (hasMessages: boolean) => void // Callback when messages are added/cleared
  onNoteClick?: (note: Note) => void // Callback when a reference note is clicked
  onManagePersonas?: () => void // Callback to open Personas management page
  className?: string
}

// Reference Notes Component - Collapsible chip design
function ReferenceNotesSection({
  notes,
  onNoteClick
}: {
  notes: Note[]
  onNoteClick?: (note: Note) => void
}) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <div className="plasmo-flex plasmo-justify-start plasmo-pl-4">
      <div className="plasmo-max-w-[80%] plasmo-space-y-2">
        {/* Collapsed View - Chips */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-px-3 plasmo-py-1.5 plasmo-bg-slate-100 hover:plasmo-bg-slate-200 plasmo-rounded-full plasmo-transition-colors plasmo-cursor-pointer">
          <svg
            className="plasmo-w-3.5 plasmo-h-3.5 plasmo-text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="plasmo-text-xs plasmo-font-medium plasmo-text-slate-700">
            {notes.length} relevant note{notes.length > 1 ? "s" : ""}
          </span>
          <svg
            className={`plasmo-w-3.5 plasmo-h-3.5 plasmo-text-slate-600 plasmo-transition-transform ${
              isExpanded ? "plasmo-rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Expanded View - Note Chips (Clickable) */}
        {isExpanded && (
          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2 plasmo-mt-2">
            {notes.map((note) => (
              <button
                key={note.id}
                onClick={() => onNoteClick?.(note)}
                className="plasmo-px-3 plasmo-py-1.5 plasmo-bg-white/20 plasmo-backdrop-blur-sm plasmo-border plasmo-border-white/40 hover:plasmo-border-blue-400 hover:plasmo-bg-blue-50/50 plasmo-rounded-full plasmo-shadow-sm hover:plasmo-shadow-md plasmo-transition-all plasmo-cursor-pointer">
                <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
                  <span className="plasmo-text-xs plasmo-font-medium plasmo-text-slate-800 plasmo-max-w-[200px] plasmo-truncate">
                    {note.title}
                  </span>
                  <span className="plasmo-px-2 plasmo-py-0.5 plasmo-bg-blue-50 plasmo-text-blue-700 plasmo-text-[10px] plasmo-rounded-full plasmo-flex-shrink-0">
                    {note.category}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function AISearchBar({
  placeholder = "Ask me anything...",
  onSearch,
  onNoteCreated,
  onNotesChange,
  onMessagesChange,
  onNoteClick,
  onManagePersonas,
  className = ""
}: AISearchBarProps) {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [isChatExpanded, setIsChatExpanded] = React.useState(true)
  const [isInputDisabled, setIsInputDisabled] = React.useState(false)
  const [isPersonaInitializing, setIsPersonaInitializing] = React.useState(true) // Track persona loading
  const [greeting, setGreeting] = React.useState(getTimeBasedGreeting())

  // Track which messages have had their clarifications handled (to hide buttons after click)
  const [handledClarifications, setHandledClarifications] = React.useState<
    Set<string>
  >(new Set())

  // Track token usage for warning banner
  const [tokenUsage, setTokenUsage] = React.useState<{
    usage: number
    quota: number
    percentage: number
  } | null>(null)

  // Track current input length for real-time validation
  const [currentInputLength, setCurrentInputLength] = React.useState(0)

  // Track manual input flow state
  const [pendingManualInput, setPendingManualInput] = React.useState<{
    type: "title" | "category" | null
    pendingNoteData?: AgentResponse["pendingNoteData"]
  }>({ type: null })

  // Store the rich content JSON when user submits (to preserve formatting)
  const [lastSubmittedContentJSON, setLastSubmittedContentJSON] =
    React.useState<any>(null)

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const editorRef = React.useRef<RichTextEditorRef>(null)

  // Notify parent when messages change
  React.useEffect(() => {
    if (onMessagesChange) {
      onMessagesChange(messages.length > 0)
    }
  }, [messages.length, onMessagesChange])

  // Update greeting every minute to keep it current
  React.useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(getTimeBasedGreeting())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Handle persona changes
  const handlePersonaChange = async (
    persona: Persona | null,
    isManualChange: boolean = true
  ) => {
    console.log(
      " [AISearchBar] Persona changed to:",
      persona?.name || "Default Mode",
      isManualChange ? "(manual)" : "(auto-restored)"
    )

    try {
      // Update the global agent with the new persona
      const agent = await getGlobalAgent()
      await agent.setPersona(persona) // Now async - recreates session

      // Clear chat history when switching personas
      setMessages([])

      // Clear handled clarifications
      setHandledClarifications(new Set())

      // Only show system message if this is a manual change (not auto-restoration)
      if (isManualChange) {
        const systemMessage: Message = {
          id: `system-${Date.now()}`,
          type: "ai",
          content: persona
            ? ` Switched to ${persona.name} persona. Conversation history cleared.\n\n${persona.description}`
            : " Switched to Default Mode. Full tool access restored.",
          timestamp: Date.now()
        }
        setMessages([systemMessage])
      }

      console.log(" [AISearchBar] Agent persona updated successfully")
    } catch (error) {
      console.error(" [AISearchBar] Error updating agent persona:", error)
    }
  }

  // Handle clearing the conversation
  const handleClearChat = async () => {
    console.log(" [AISearchBar] Clearing chat...")

    // Clear local messages
    setMessages([])

    // Clear handled clarifications
    setHandledClarifications(new Set())

    // Clear the agent's session
    const agent = await getGlobalAgent()
    await agent.clearSession()

    // Clear any pending input state
    setPendingManualInput({ type: null })

    // Clear the editor
    editorRef.current?.setContent("")

    // Clear last submitted content
    setLastSubmittedContentJSON(null)

    // Clear token usage warning
    setTokenUsage(null)

    // Clear input length tracker
    setCurrentInputLength(0)

    console.log(" [AISearchBar] Chat cleared")
  }

  // Check and update token usage
  const checkTokenUsage = async () => {
    try {
      const { getSessionTokenUsage } = await import(
        "~services/gemini-nano-service"
      )
      const agent = await getGlobalAgent()
      const sessionId = agent.getSessionId()

      if (sessionId) {
        const usage = getSessionTokenUsage(sessionId)
        if (usage) {
          setTokenUsage(usage)

          // Log token usage for debugging
          console.log(
            ` [Token Usage] ${usage.usage}/${usage.quota} tokens (${usage.percentage.toFixed(1)}% used) - ${(usage.quota - usage.usage).toFixed(0)} remaining`
          )

          // Warn if approaching limit
          if (usage.percentage >= 80) {
            console.warn(
              ` [Token Warning] Approaching token limit! ${usage.percentage.toFixed(1)}% used`
            )
          }
        }
      }
    } catch (error) {
      console.error("Failed to check token usage:", error)
    }
  }

  // Estimate token count (rough approximation: ~4 chars per token)
  const estimateTokens = (text: string): number => {
    // Rule of thumb: 1 token ≈ 4 characters or 0.75 words
    return Math.ceil(text.length / 4)
  }

  // Validate if input would exceed safe token limits
  const validateInputSize = (
    inputText: string
  ): { valid: boolean; reason?: string } => {
    const estimatedInputTokens = estimateTokens(inputText)
    const MAX_INPUT_TOKENS = 2000 // Safe threshold for single message (leaves room for response)
    const SAFE_SESSION_THRESHOLD = 7000 // Don't allow new messages if session already at 7000 tokens

    // Check 1: Input itself is too large
    if (estimatedInputTokens > MAX_INPUT_TOKENS) {
      return {
        valid: false,
        reason: `Input too long (~${estimatedInputTokens} tokens). Please limit to ${MAX_INPUT_TOKENS} tokens (~${MAX_INPUT_TOKENS * 4} characters).`
      }
    }

    // Check 2: Session already too full
    if (tokenUsage && tokenUsage.usage >= SAFE_SESSION_THRESHOLD) {
      return {
        valid: false,
        reason: `Session limit reached (${tokenUsage.usage}/${tokenUsage.quota} tokens). Please start a new chat.`
      }
    }

    // Check 3: Combined would exceed quota
    if (tokenUsage) {
      const projectedTotal = tokenUsage.usage + estimatedInputTokens + 500 // +500 for response
      if (projectedTotal > tokenUsage.quota) {
        return {
          valid: false,
          reason: `Input would exceed token limit (~${estimatedInputTokens} tokens). ${Math.floor(tokenUsage.quota - tokenUsage.usage - 500)} tokens remaining.`
        }
      }
    }

    return { valid: true }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    // Get both text and JSON from TipTap editor
    const query = editorRef.current?.getText()?.trim() || ""
    const contentJSON = editorRef.current?.getJSON() // Capture rich formatting

    if (query && onSearch && !isSearching) {
      // Store the rich content JSON for later use when saving
      setLastSubmittedContentJSON(contentJSON)

      // Check if we're waiting for manual input (title or category)
      if (pendingManualInput.type && pendingManualInput.pendingNoteData) {
        console.log("Processing manual input:", pendingManualInput.type, query)

        if (pendingManualInput.type === "category") {
          // User provided manual category
          await handleClarificationOption(
            "select_category",
            query,
            pendingManualInput.pendingNoteData
          )
        } else if (pendingManualInput.type === "title") {
          // User provided manual title
          await handleClarificationOption(
            "use_manual_title",
            query,
            pendingManualInput.pendingNoteData
          )
        }

        // Clear pending state and editor
        setPendingManualInput({ type: null })
        editorRef.current?.setContent("")
        return
      }

      // Normal search/query flow
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        type: "user",
        content: query,
        timestamp: Date.now()
      }

      setMessages((prev) => [...prev, userMessage])
      editorRef.current?.setContent("") // Clear editor
      setCurrentInputLength(0) // Clear input length tracker
      setIsSearching(true)

      try {
        // Build conversation history (exclude system messages)
        const conversationHistory = messages
          .filter((m) => m.type === "user" || m.type === "ai")
          .map((m) => ({
            role: m.type === "user" ? "user" : "assistant",
            content: m.content
          }))

        // Add current query
        conversationHistory.push({ role: "user", content: query })

        const aiResponse = await onSearch(query, conversationHistory)

        // Check if response is an AgentResponse object (has aiResponse field or referenceNotes)
        if (
          typeof aiResponse === "object" &&
          ("aiResponse" in aiResponse || "referenceNotes" in aiResponse)
        ) {
          // Fetch full note details for reference notes if available
          let fullReferenceNotes: Note[] = []
          if (
            aiResponse.referenceNotes &&
            aiResponse.referenceNotes.length > 0
          ) {
            console.log("Fetching reference notes:", aiResponse.referenceNotes)
            const { getNote } = await import("~services/db-service")
            const notePromises = aiResponse.referenceNotes.map((noteId) =>
              getNote(noteId)
            )
            const notes = await Promise.all(notePromises)
            fullReferenceNotes = notes.filter(
              (note): note is Note => note !== null
            )
            console.log("Fetched full reference notes:", fullReferenceNotes)
          }

          const aiMessage: Message = {
            id: `ai-${Date.now()}`,
            type: "ai",
            content: aiResponse.aiResponse || "",
            timestamp: Date.now(),
            clarificationOptions: aiResponse.clarificationOptions,
            pendingNoteData: aiResponse.pendingNoteData,
            referenceNotes: fullReferenceNotes
          }
          setMessages((prev) => [...prev, aiMessage])

          // Disable input if clarification is needed
          if (aiResponse.needsClarification) {
            setIsInputDisabled(true)
          }

          // If a note was created, refresh the notes list
          if (aiResponse.noteCreated && onNoteCreated) {
            console.log("Note created, calling onNoteCreated callback")
            onNoteCreated()
          }

          // Check token usage after AI response
          await checkTokenUsage()
        } else {
          // String response (legacy support - should not happen with new agent)
          const aiMessage: Message = {
            id: `ai-${Date.now()}`,
            type: "ai",
            content:
              typeof aiResponse === "string" ? aiResponse : String(aiResponse),
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, aiMessage])

          // Check token usage after AI response
          await checkTokenUsage()
        }
      } catch (error) {
        console.error("Search error:", error)
        const errorMessage: Message = {
          id: `ai-error-${Date.now()}`,
          type: "ai",
          content: "Sorry, I couldn't process your request. Please try again.",
          timestamp: Date.now()
        }
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setIsSearching(false)
      }
    }
  }

  const handleClarificationOption = async (
    action: string,
    value: any,
    pendingNoteData?: AgentResponse["pendingNoteData"],
    messageId?: string
  ) => {
    const callId = `${action}-${Date.now()}`
    console.log(`[${callId}] Clarification option selected:`, {
      action,
      value,
      pendingNoteData,
      messageId
    })

    // Mark this message's clarification as handled (hide buttons)
    if (messageId) {
      setHandledClarifications((prev) => new Set(prev).add(messageId))
    }

    if (!pendingNoteData) {
      console.error(`[${callId}] No pending note data found`)
      setIsInputDisabled(false)
      return
    }

    // Prevent duplicate executions
    if (isSearching) {
      console.warn(
        `[${callId}] Already processing clarification, ignoring duplicate call`
      )
      return
    }

    console.log(`[${callId}] Setting isSearching to true`)
    setIsSearching(true)

    try {
      // Import necessary services
      const { generateTitle, generateCategory } = await import(
        "~services/ai-service"
      )
      const { addNote } = await import("~services/db-service")

      let finalTitle = pendingNoteData.title || ""
      let finalCategory = pendingNoteData.category || ""
      const noteContent = pendingNoteData.content || ""

      // Handle different actions
      switch (action) {
        case "cancel_note_creation": {
          // User chose to cancel the note creation flow
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: "user",
            content: " Cancel",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, userMessage])

          const cancelMessage: Message = {
            id: `ai-${Date.now()}`,
            type: "ai",
            content:
              "No problem! Note creation cancelled. How else can I help you?",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, cancelMessage])

          // Clear pending manual input state
          setPendingManualInput({ type: null })

          // Re-enable input
          setIsSearching(false)
          setIsInputDisabled(false)
          return
        }

        case "auto_generate_both": {
          // User chose to auto-generate both title and category
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: "user",
            content: " Auto-generate both title and category",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, userMessage])

          const loadingMessage: Message = {
            id: `ai-loading-${Date.now()}`,
            type: "ai",
            content: "Generating title and category...",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, loadingMessage])

          // Generate both in parallel
          const [generatedTitle, generatedCategory] = await Promise.all([
            generateTitle("", noteContent),
            generateCategory(noteContent)
          ])

          finalTitle = generatedTitle
          finalCategory = generatedCategory

          // Remove loading message
          setMessages((prev) => prev.filter((m) => m.id !== loadingMessage.id))

          const confirmMessage: Message = {
            id: `ai-${Date.now()}`,
            type: "ai",
            content: `Great! I've generated:\n Title: "${finalTitle}"\n Category: "${finalCategory}"\n\nCreating your note now...`,
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, confirmMessage])

          // Continue to note creation below
          break
        }

        case "start_manual_flow": {
          // User chose to manually provide title and/or category
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: "user",
            content: " I'll choose manually",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, userMessage])

          // Show options to start with title or category
          const clarificationMessage: Message = {
            id: `ai-${Date.now()}`,
            type: "ai",
            content:
              "No problem! Would you like to start by providing a title or choosing a category?",
            timestamp: Date.now(),
            clarificationOptions: [
              {
                type: "button",
                label: "Auto-generate Title",
                value: "auto",
                action: "auto_generate_title"
              },
              {
                type: "button",
                label: "I'll provide a title",
                value: "manual",
                action: "manual_title"
              },
              {
                type: "button",
                label: "Auto-generate Category",
                value: "auto",
                action: "auto_generate_category"
              },
              {
                type: "button",
                label: "I'll provide a category",
                value: "manual",
                action: "manual_category"
              }
            ],
            pendingNoteData: {
              content: noteContent,
              title: undefined,
              category: undefined
            }
          }
          setMessages((prev) => [...prev, clarificationMessage])
          setIsSearching(false)
          return
        }

        case "auto_generate_title": {
          // User chose to auto-generate title
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: "user",
            content: " Auto-generate title",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, userMessage])

          const loadingMessage: Message = {
            id: `ai-loading-${Date.now()}`,
            type: "ai",
            content: "Generating title...",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, loadingMessage])

          finalTitle = await generateTitle("", noteContent)

          // Remove loading message
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== loadingMessage.id)
          )

          // If category is still missing, ask for it
          if (!finalCategory) {
            const clarificationMessage: Message = {
              id: `ai-${Date.now()}`,
              type: "ai",
              content: `Great! I've generated the title: "${finalTitle}". Now, which category would you like to use?`,
              timestamp: Date.now(),
              clarificationOptions: [
                {
                  type: "button",
                  label: "Auto-generate Category",
                  value: "auto",
                  action: "auto_generate_category"
                },
                {
                  type: "button",
                  label: "I'll provide a category",
                  value: "manual",
                  action: "manual_category"
                }
              ],
              pendingNoteData: {
                content: noteContent,
                title: finalTitle,
                category: undefined
              }
            }
            setMessages((prev) => [...prev, clarificationMessage])
            setIsSearching(false)
            return
          }
          break
        }

        case "manual_title": {
          // User wants to provide title manually
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: "user",
            content: " I'll provide a title",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, userMessage])

          const promptMessage: Message = {
            id: `ai-${Date.now()}`,
            type: "ai",
            content: "Please type the title you'd like to use:",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, promptMessage])

          // Set pending state to capture next user input as title
          setPendingManualInput({
            type: "title",
            pendingNoteData: {
              content: noteContent,
              title: undefined,
              category: finalCategory
            }
          })

          setIsInputDisabled(false)
          setIsSearching(false)
          return
        }

        case "auto_generate_category": {
          // User chose to auto-generate category
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: "user",
            content: " Auto-generate category",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, userMessage])

          const loadingMessage: Message = {
            id: `ai-loading-${Date.now()}`,
            type: "ai",
            content: "Generating category...",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, loadingMessage])

          finalCategory = await generateCategory(noteContent)

          // Remove loading message
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== loadingMessage.id)
          )

          // If title is still missing, ask for it
          if (!finalTitle) {
            const clarificationMessage: Message = {
              id: `ai-${Date.now()}`,
              type: "ai",
              content: `Great! I've generated the category: "${finalCategory}". Now, what title would you like?`,
              timestamp: Date.now(),
              clarificationOptions: [
                {
                  type: "button",
                  label: "Auto-generate Title",
                  value: "auto",
                  action: "auto_generate_title"
                },
                {
                  type: "button",
                  label: "I'll provide a title",
                  value: "manual",
                  action: "manual_title"
                }
              ],
              pendingNoteData: {
                content: noteContent,
                title: undefined,
                category: finalCategory
              }
            }
            setMessages((prev) => [...prev, clarificationMessage])
            setIsSearching(false)
            return
          }
          break
        }

        case "select_category": {
          // User selected an existing category
          finalCategory = value
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: "user",
            content: ` ${value}`,
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, userMessage])

          // If title is still missing, ask for it
          if (!finalTitle) {
            const clarificationMessage: Message = {
              id: `ai-${Date.now()}`,
              type: "ai",
              content: `Perfect! Category set to "${finalCategory}". Now, what title would you like?`,
              timestamp: Date.now(),
              clarificationOptions: [
                {
                  type: "button",
                  label: "Auto-generate Title",
                  value: "auto",
                  action: "auto_generate_title"
                },
                {
                  type: "button",
                  label: "I'll provide a title",
                  value: "manual",
                  action: "manual_title"
                }
              ],
              pendingNoteData: {
                content: noteContent,
                title: undefined,
                category: finalCategory
              }
            }
            setMessages((prev) => [...prev, clarificationMessage])
            setIsSearching(false)
            return
          }
          break
        }

        case "manual_category": {
          // User wants to provide category manually
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: "user",
            content: " I'll provide a category",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, userMessage])

          const promptMessage: Message = {
            id: `ai-${Date.now()}`,
            type: "ai",
            content: "Please type the category you'd like to use:",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, promptMessage])

          // Set pending state to capture next user input as category
          setPendingManualInput({
            type: "category",
            pendingNoteData: {
              content: noteContent,
              title: finalTitle,
              category: undefined
            }
          })

          setIsInputDisabled(false)
          setIsSearching(false)
          return
        }

        case "use_manual_title": {
          // User provided a manual title (comes from handleSubmit)
          finalTitle = value
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: "user",
            content: ` "${value}"`,
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, userMessage])

          // If category is still missing, ask for it
          if (!finalCategory) {
            const clarificationMessage: Message = {
              id: `ai-${Date.now()}`,
              type: "ai",
              content: `Perfect! Title set to "${finalTitle}". Now, which category would you like to use?`,
              timestamp: Date.now(),
              clarificationOptions: [
                {
                  type: "button",
                  label: "Auto-generate Category",
                  value: "auto",
                  action: "auto_generate_category"
                },
                {
                  type: "button",
                  label: "I'll provide a category",
                  value: "manual",
                  action: "manual_category"
                }
              ],
              pendingNoteData: {
                content: noteContent,
                title: finalTitle,
                category: undefined
              }
            }
            setMessages((prev) => [...prev, clarificationMessage])
            setIsInputDisabled(true)
            setIsSearching(false)
            return
          }
          break
        }

        case "confirm_organize": {
          // Handle organization confirmation
          console.log(`[${callId}] Organization confirmation:`, value)

          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: "user",
            content: value.confirmed ? " Yes, move it" : " No, keep it here",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, userMessage])

          // Call the confirm_organize_note tool
          const { getGlobalAgent } = await import("~services/langchain-agent")
          const agent = await getGlobalAgent()

          // Get the confirm tool directly
          const { confirmOrganizeNoteTool } = await import(
            "~services/langchain-tools"
          )

          const result = await confirmOrganizeNoteTool.func({
            noteId: value.noteId,
            targetCategory: value.targetCategory,
            userConfirmed: value.confirmed
          })

          const parsedResult = JSON.parse(result)

          const aiMessage: Message = {
            id: `ai-${Date.now()}`,
            type: "ai",
            content: parsedResult.message,
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, aiMessage])

          setIsInputDisabled(false)
          setIsSearching(false)

          // Refresh notes if category was changed
          if (parsedResult.action === "moved" && onNotesChange) {
            await onNotesChange()
          }

          return
        }

        default:
          console.warn("Unknown clarification action:", action)
          setIsInputDisabled(false)
          setIsSearching(false)
          return
      }

      // If we have both title and category, create the note
      if (finalTitle && finalCategory && noteContent) {
        const noteCreationId = `note-${Date.now()}`
        console.log(`[${callId}] [${noteCreationId}] Creating note with:`, {
          finalTitle,
          finalCategory,
          noteContent: noteContent.substring(0, 100) + "..."
        })

        // Generate embedding (same as in sidepanel.tsx handleSaveNote)
        const saveStartTime = performance.now()
        console.log(
          `[${noteCreationId}] [AI Chat] Creating new note via agent...`
        )

        // Step 1: Generate embedding from plaintext content
        const embeddingStartTime = performance.now()
        const { generateEmbedding } = await import("~services/ai-service")
        const embedding = await generateEmbedding(noteContent)
        const embeddingTime = performance.now() - embeddingStartTime
        console.log(
          `⏱ [AI Chat] Embedding generation: ${embeddingTime.toFixed(2)}ms (${embedding.length} dimensions)`
        )

        // Get current tab URL for sourceUrl
        let sourceUrl: string | undefined
        try {
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          sourceUrl = tabs[0]?.url
        } catch (e) {
          console.warn("Could not get tab URL:", e)
        }

        // Step 2: Use the stored TipTap JSON (with rich formatting) or convert plain text
        let contentJSONString: string
        if (lastSubmittedContentJSON && noteContent) {
          // Extract only the portion of TipTap JSON that matches the agent's extracted content
          console.log(" Extracting relevant portion from rich content JSON...")

          // Get the full markdown from the stored JSON to compare
          const fullMarkdown = tiptapToMarkdown(lastSubmittedContentJSON)

          // Check if noteContent is a subset of fullMarkdown (agent extracted only part)
          if (
            fullMarkdown.includes(noteContent) &&
            fullMarkdown.length > noteContent.length
          ) {
            console.log(
              " Agent extracted partial content, filtering TipTap nodes..."
            )

            // Filter TipTap nodes to only include those that are part of noteContent
            const filteredNodes: any[] = []
            let accumulatedMarkdown = ""

            for (const node of lastSubmittedContentJSON.content || []) {
              const nodeMarkdown = tiptapToMarkdown({
                type: "doc",
                content: [node]
              })

              // Check if this node is part of the extracted content
              if (noteContent.includes(nodeMarkdown.trim())) {
                filteredNodes.push(node)
                accumulatedMarkdown += nodeMarkdown + "\n"

                // Stop if we've accumulated enough content
                if (accumulatedMarkdown.trim().length >= noteContent.length) {
                  break
                }
              }
            }

            if (filteredNodes.length > 0) {
              contentJSONString = JSON.stringify({
                type: "doc",
                content: filteredNodes
              })
              console.log(
                ` Filtered to ${filteredNodes.length} nodes (removed prompt)`
              )
            } else {
              // Fallback: use the full content if filtering failed
              contentJSONString = JSON.stringify(lastSubmittedContentJSON)
              console.log(" Filtering failed, using full content")
            }
          } else {
            // Content matches exactly, use full JSON
            console.log(" Content matches exactly, using full rich JSON")
            contentJSONString = JSON.stringify(lastSubmittedContentJSON)
          }
        } else {
          // Fallback: Convert plain text to TipTap JSON format (for backward compatibility)
          console.log(" No rich content found, converting plain text to JSON")
          const contentJSON = {
            type: "doc",
            content: noteContent
              .split("\n")
              .filter((line) => line.trim() !== "")
              .map((line) => ({
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: line
                  }
                ]
              }))
          }
          contentJSONString = JSON.stringify(contentJSON)
        }

        // Step 3: Send to background script with pre-generated embedding
        // (Same pattern as sidepanel.tsx)
        const messageStartTime = performance.now()
        const response = await chrome.runtime.sendMessage({
          type: "SAVE_NOTE",
          data: {
            title: finalTitle,
            content: contentJSONString, // Now properly formatted as TipTap JSON
            contentPlaintext: noteContent,
            category: finalCategory,
            sourceUrl,
            embedding
          }
        })
        const messageTime = performance.now() - messageStartTime
        console.log(
          `⏱ [AI Chat] Background processing (encrypt + DB): ${messageTime.toFixed(2)}ms`
        )

        if (!response.success) {
          throw new Error(response.error || "Failed to create note")
        }

        const totalTime = performance.now() - saveStartTime
        console.log(` [AI Chat] TOTAL save time: ${totalTime.toFixed(2)}ms`)
        console.log(
          ` [AI Chat] Breakdown: Embedding=${embeddingTime.toFixed(2)}ms, Background=${messageTime.toFixed(2)}ms`
        )

        const successMessage: Message = {
          id: `ai-${Date.now()}`,
          type: "ai",
          content: ` Note created successfully!\n\n Title: "${finalTitle}"\n Category: ${finalCategory}`,
          timestamp: Date.now()
        }
        setMessages((prev) => [...prev, successMessage])

        // Clear the stored content JSON after successful save
        setLastSubmittedContentJSON(null)

        // Notify parent component to refresh notes list
        if (onNoteCreated) {
          onNoteCreated()
        }

        // Now check if we should organize the note
        const noteId = response.note?.id
        if (noteId) {
          console.log(
            `[${callId}] Running organize_note tool for newly created note:`,
            noteId
          )

          try {
            // Import and call the organize note tool
            const { organizeNoteTool } = await import(
              "~services/langchain-tools"
            )

            const organizeResult = await organizeNoteTool.func({
              noteId: noteId
            })

            const organizeData = JSON.parse(organizeResult)
            console.log(`[${callId}] Organize result:`, organizeData)

            // Check if reorganization is needed
            if (
              organizeData.needsReorganization &&
              organizeData.suggestedCategory
            ) {
              console.log(
                `[${callId}] Reorganization suggested:`,
                organizeData.suggestedCategory
              )

              // Show organization suggestion message
              const organizeMessage: Message = {
                id: `ai-organize-${Date.now()}`,
                type: "ai",
                content: organizeData.message,
                timestamp: Date.now(),
                clarificationOptions: [
                  {
                    type: "button",
                    label: "Yes, move it",
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
                    label: "No, keep it here",
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
              setMessages((prev) => [...prev, organizeMessage])
              setIsInputDisabled(true) // Keep input disabled until user responds
              setIsSearching(false)
              return // Exit early to wait for user response
            } else {
              console.log(
                `[${callId}] No reorganization needed or no similar notes found`
              )
            }
          } catch (error) {
            console.error(`[${callId}] Error running organize_note:`, error)
            // Don't fail the entire operation, just log and continue
          }
        }

        // Re-enable input
        setIsInputDisabled(false)
      }
    } catch (error) {
      console.error("Error handling clarification:", error)
      const errorMessage: Message = {
        id: `ai-error-${Date.now()}`,
        type: "ai",
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: Date.now()
      }
      setMessages((prev) => [...prev, errorMessage])
      setIsInputDisabled(false)
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Allow Shift+Enter for new line, Enter alone submits
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className={`plasmo-flex plasmo-flex-col plasmo-h-full ${className}`}>
      {/* Header Section - Dynamic Greeting and Controls */}
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-py-2 plasmo-px-3 plasmo-border-b plasmo-border-slate-200">
        {/* Left: MIND KEEP label and greeting */}
        <div className="plasmo-flex plasmo-flex-col plasmo-gap-1">
          <span className="plasmo-text-[8px] plasmo-font-medium plasmo-text-slate-500 plasmo-uppercase plasmo-tracking-wider">
            Mind Keep
          </span>
          <div className="plasmo-flex plasmo-flex-col plasmo-gap-0.5">
            <span className="plasmo-text-base plasmo-font-light plasmo-text-slate-700">
              {greeting}!
            </span>
            <span className="plasmo-text-base plasmo-font-normal plasmo-text-slate-800">
              May I help you with anything?
            </span>
          </div>
        </div>

        {/* Right: Clear & Toggle buttons */}
        {messages.length > 0 && (
          <div className="plasmo-flex-shrink-0 plasmo-flex plasmo-items-center plasmo-gap-2">
            {/* Clear chat button */}
            <button
              onClick={handleClearChat}
              className="plasmo-p-1.5 plasmo-rounded-lg plasmo-text-slate-500 hover:plasmo-text-red-600 hover:plasmo-bg-red-50 plasmo-transition-colors"
              title="Clear conversation">
              <svg
                className="plasmo-w-4 plasmo-h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>

            {/* Toggle chat history button */}
            <button
              onClick={() => setIsChatExpanded(!isChatExpanded)}
              className="plasmo-p-1.5 plasmo-rounded-lg plasmo-text-slate-500 hover:plasmo-text-slate-700 hover:plasmo-bg-slate-100 plasmo-transition-colors"
              title={
                isChatExpanded ? "Hide chat history" : "Show chat history"
              }>
              {isChatExpanded ? (
                <svg
                  className="plasmo-w-4 plasmo-h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              ) : (
                <svg
                  className="plasmo-w-4 plasmo-h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Token Limit Warning Banner */}
      {tokenUsage && tokenUsage.percentage >= 90 && (
        <div
          className={`plasmo-px-4 plasmo-py-3 plasmo-rounded-lg plasmo-border plasmo-flex plasmo-items-start plasmo-gap-3 ${
            tokenUsage.percentage >= 95
              ? "plasmo-border-red-300 plasmo-text-red-800"
              : "plasmo-border-amber-300 plasmo-text-amber-800"
          }`}>
          <div className="plasmo-flex-1">
            <div className="plasmo-text-xs plasmo-mb-2">
              {"Summarizing conversation history"}
            </div>
            {/* <button
 onClick={handleClearChat}
 className={`plasmo-px-3 plasmo-py-1.5 plasmo-rounded plasmo-text-xs plasmo-font-medium plasmo-transition-colors ${
 tokenUsage.percentage >= 95
 ? "plasmo-bg-red-600 hover:plasmo-bg-red-700 plasmo-text-white"
 : "plasmo-bg-amber-600 hover:plasmo-bg-amber-700 plasmo-text-white"
 }`}>
 Start New Chat
 </button> */}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      {messages.length > 0 && isChatExpanded && (
        <div className="plasmo-flex-1 plasmo-overflow-y-auto plasmo-space-y-4 plasmo-px-4 plasmo-py-4 plasmo-max-h-[500px] plasmo-bg-white/10 plasmo-backdrop-blur-lg plasmo-rounded-2xl plasmo-border plasmo-border-white/30 plasmo-mb-4">
          {messages.map((message) => (
            <div key={message.id} className="plasmo-space-y-2">
              <div
                className={`plasmo-flex ${
                  message.type === "user"
                    ? "plasmo-justify-end"
                    : "plasmo-justify-start"
                }`}>
                <div
                  className={`plasmo-px-4 plasmo-py-3 plasmo-rounded-2xl plasmo-shadow-sm plasmo-max-w-[85%] ${
                    message.type === "user"
                      ? "plasmo-bg-gradient-to-br plasmo-from-gray-50 plasmo-via-gray-100/80 plasmo-to-gray-100 plasmo-text-slate-900 plasmo-border plasmo-border-gray-200/50"
                      : "plasmo-bg-gradient-to-br plasmo-from-white plasmo-via-blue-50/30 plasmo-to-purple-50/20 plasmo-backdrop-blur-md plasmo-text-slate-900 plasmo-border plasmo-border-slate-200/50"
                  }`}>
                  {message.type === "user" ? (
                    <div className="plasmo-text-sm plasmo-whitespace-pre-wrap plasmo-text-slate-900">
                      {message.content}
                    </div>
                  ) : (
                    <MarkdownRenderer content={message.content} />
                  )}
                </div>
              </div>

              {/* Clarification Options - Only show if not handled */}
              {message.clarificationOptions &&
                message.clarificationOptions.length > 0 &&
                !handledClarifications.has(message.id) && (
                  <div className="plasmo-flex plasmo-justify-start">
                    <div className="plasmo-max-w-[80%] plasmo-space-y-2">
                      <div className="plasmo-text-xs plasmo-font-light plasmo-text-slate-600 plasmo-pl-2">
                        Choose an option:
                      </div>
                      <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2">
                        {message.clarificationOptions.map((option, idx) => (
                          <button
                            key={idx}
                            disabled={isSearching}
                            onClick={() =>
                              handleClarificationOption(
                                option.action,
                                option.value,
                                message.pendingNoteData,
                                message.id
                              )
                            }
                            className={`${
                              option.type === "category_pill"
                                ? "plasmo-px-3 plasmo-py-1.5 plasmo-bg-blue-50 hover:plasmo-bg-blue-100 plasmo-text-blue-700 plasmo-border plasmo-border-blue-200 hover:plasmo-border-blue-300"
                                : "plasmo-px-4 plasmo-py-2 plasmo-bg-white/20 plasmo-backdrop-blur-sm hover:plasmo-bg-white/30 plasmo-text-slate-900 plasmo-border plasmo-border-white/40 hover:plasmo-border-white/50"
                            } plasmo-rounded-full plasmo-text-[12px] plasmo-font-normal plasmo-transition-all plasmo-cursor-pointer plasmo-shadow-sm hover:plasmo-shadow disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed`}>
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              {/* Reference Notes */}
              {message.referenceNotes && message.referenceNotes.length > 0 && (
                <ReferenceNotesSection
                  notes={message.referenceNotes}
                  onNoteClick={onNoteClick}
                />
              )}
            </div>
          ))}
          {isSearching && (
            <div className="plasmo-flex plasmo-justify-start">
              <div className="plasmo-max-w-[80%] plasmo-px-4 plasmo-py-2 plasmo-rounded-lg plasmo-bg-white/20 plasmo-backdrop-blur-md plasmo-text-slate-900 plasmo-border plasmo-border-white/40">
                <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
                  <div className="plasmo-w-2 plasmo-h-2 plasmo-bg-slate-400 plasmo-rounded-full plasmo-animate-bounce" />
                  <div
                    className="plasmo-w-2 plasmo-h-2 plasmo-bg-slate-400 plasmo-rounded-full plasmo-animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <div
                    className="plasmo-w-2 plasmo-h-2 plasmo-bg-slate-400 plasmo-rounded-full plasmo-animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Search Input */}
      <form onSubmit={handleSubmit} className="plasmo-mt-auto">
        {/* Input length indicator - show if getting close to limit */}
        {currentInputLength > 4000 && (
          <div
            className={`plasmo-px-3 plasmo-py-1 plasmo-text-xs plasmo-mb-2 plasmo-rounded-lg ${
              currentInputLength > 7000
                ? "plasmo-bg-red-50 plasmo-text-red-700"
                : currentInputLength > 6000
                  ? "plasmo-bg-amber-50 plasmo-text-amber-700"
                  : "plasmo-bg-blue-50 plasmo-text-blue-700"
            }`}>
            Input: {currentInputLength.toLocaleString()} chars
            {currentInputLength > 7000 && " - Too large! Please reduce."}
          </div>
        )}

        <div className="plasmo-bg-white/90 plasmo-backdrop-blur-sm plasmo-rounded-[10px] plasmo-px-4 plasmo-py-3 plasmo-border plasmo-border-slate-200/80 hover:plasmo-border-slate-300 plasmo-transition-all focus-within:plasmo-border-slate-400 plasmo-shadow-sm plasmo-space-y-3">
          {/* Rich Text Editor - Full Width on Top */}
          <div
            className="plasmo-w-full plasmo-overflow-y-auto plasmo-no-visible-scrollbar"
            style={{ minHeight: "2.5em", maxHeight: "150px" }}>
            <RichTextEditor
              ref={editorRef}
              placeholder={
                isInputDisabled
                  ? "Please select an option above..."
                  : placeholder
              }
              showToolbar={false}
              compact={true}
              onSubmit={handleSubmit}
              onUpdate={() => {
                // Track input length for validation feedback
                const currentText = editorRef.current?.getText() || ""
                setCurrentInputLength(currentText.length)
              }}
            />
          </div>

          {/* Bottom Row: Persona Selector + Submit Button */}
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-gap-3 plasmo-pt-2 plasmo-border-t plasmo-border-slate-100">
            {/* Persona Selector - Left Side */}
            <div className="plasmo-flex-shrink-0">
              <PersonaSelector
                onPersonaChange={handlePersonaChange}
                onInitializationChange={setIsPersonaInitializing}
                onManageClick={onManagePersonas}
              />
            </div>

            {/* Submit Button - Right Side */}
            <button
              type="submit"
              className="plasmo-flex-shrink-0 plasmo-w-9 plasmo-h-9 plasmo-bg-slate-900 plasmo-text-white plasmo-rounded-lg plasmo-flex plasmo-items-center plasmo-justify-center hover:plasmo-bg-slate-700 plasmo-transition-colors disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed"
              title={
                isPersonaInitializing
                  ? "Loading persona..."
                  : currentInputLength > 8000
                    ? "Input too large (max 8000 chars)"
                    : tokenUsage && tokenUsage.usage >= 7000
                      ? "Session limit reached - start new chat"
                      : "Send (Enter)"
              }
              disabled={
                isPersonaInitializing ||
                isSearching ||
                isInputDisabled ||
                currentInputLength > 8000 ||
                (tokenUsage !== null && tokenUsage.usage >= 7000)
              }>
              <svg
                className="plasmo-w-4 plasmo-h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
