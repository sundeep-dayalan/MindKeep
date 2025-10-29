import { DotLottieReact } from "@lottiefiles/dotlottie-react"
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
import {
  clearChatMessages,
  loadChatMessages,
  saveChatMessages
} from "~util/session-storage"
import { tiptapToMarkdown } from "~util/tiptap-to-markdown"
import { logger } from "~utils/logger"

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
  type: "user" | "ai" | "system"
  content: string
  timestamp: number
  clarificationOptions?: AgentResponse["clarificationOptions"]
  pendingNoteData?: AgentResponse["pendingNoteData"]
  referenceNotes?: Note[]
}

interface AISearchBarProps {
  placeholder?: string
  onSearch?: (
    query: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    onStreamChunk?: (chunk: string) => void
  ) => Promise<string | AgentResponse>
  onNoteCreated?: () => void
  onNotesChange?: () => Promise<void>
  onMessagesChange?: (hasMessages: boolean) => void
  onNoteClick?: (note: Note) => void
  onManagePersonas?: () => void
  onStartTour?: () => void
  className?: string
  maxInputHeight?: string
  personaDropdownUpward?: boolean
  enableInsertMode?: boolean
  onInsert?: (text: string) => void
}

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
        {}
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

        {}
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
  onStartTour,
  className = "",
  maxInputHeight = "150px",
  personaDropdownUpward = true,
  enableInsertMode = false,
  onInsert
}: AISearchBarProps) {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [isChatExpanded, setIsChatExpanded] = React.useState(true)
  const [isInputDisabled, setIsInputDisabled] = React.useState(false)
  const [isPersonaInitializing, setIsPersonaInitializing] = React.useState(true)
  const [greeting, setGreeting] = React.useState(getTimeBasedGreeting())
  const [isLoadingFromStorage, setIsLoadingFromStorage] = React.useState(true)
  const [showInsertButton, setShowInsertButton] = React.useState(false)

  const [handledClarifications, setHandledClarifications] = React.useState<
    Set<string>
  >(new Set())

  const [tokenUsage, setTokenUsage] = React.useState<{
    usage: number
    quota: number
    percentage: number
  } | null>(null)

  const [currentInputLength, setCurrentInputLength] = React.useState(0)

  const [pendingManualInput, setPendingManualInput] = React.useState<{
    type: "title" | "category" | null
    pendingNoteData?: AgentResponse["pendingNoteData"]
  }>({ type: null })

  const [expandedMessages, setExpandedMessages] = React.useState<Set<string>>(
    new Set()
  )

  const [copiedMessageId, setCopiedMessageId] = React.useState<string | null>(
    null
  )

  const [lastSubmittedContentJSON, setLastSubmittedContentJSON] =
    React.useState<any>(null)

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const editorRef = React.useRef<RichTextEditorRef>(null)

  React.useEffect(() => {
    const loadStoredMessages = async () => {
      try {
        const storedMessages = await loadChatMessages()
        if (storedMessages.length > 0) {
          logger.log(
            ` [AISearchBar] Restored ${storedMessages.length} messages from session storage`
          )
          setMessages(storedMessages)
        }
      } catch (error) {
        logger.error("Failed to load messages from storage:", error)
      } finally {
        setIsLoadingFromStorage(false)
      }
    }

    loadStoredMessages()
  }, [])

  React.useEffect(() => {
    if (isLoadingFromStorage) {
      return
    }

    saveChatMessages(messages).catch((error) => {
      logger.error("Failed to save messages to storage:", error)
    })
  }, [messages, isLoadingFromStorage])

  React.useEffect(() => {
    if (onMessagesChange) {
      onMessagesChange(messages.length > 0)
    }
  }, [messages.length, onMessagesChange])

  React.useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(getTimeBasedGreeting())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)

      setTimeout(() => {
        setCopiedMessageId(null)
      }, 2000)

      logger.log(" [AISearchBar] Message copied to clipboard")
    } catch (error) {
      logger.error(" [AISearchBar] Failed to copy message:", error)
    }
  }

  const handlePersonaChange = async (
    persona: Persona | null,
    isManualChange: boolean = true
  ) => {
    logger.log(
      "[AISearchBar] handlePersonaChange called:",
      persona?.name || "Default Mode",
      isManualChange ? "(manual)" : "(auto-restored)"
    )

    try {
      logger.log("[AISearchBar] Getting global agent with persona...")
      const agent = await getGlobalAgent(persona)

      logger.log("[AISearchBar] Verifying persona was set...")
      const currentPersona = agent.getPersona()
      const currentMode = agent.getMode()
      logger.log("[AISearchBar] Agent state after initialization:", {
        personaName: currentPersona?.name || "None",
        mode: currentMode,
        sessionId: agent.getSessionId()
      })

      const currentId = currentPersona?.id || null
      const newId = persona?.id || null
      if (currentId !== newId) {
        logger.log("[AISearchBar] Persona mismatch, calling setPersona()...")
        await agent.setPersona(persona)
      }

      setMessages([])

      setHandledClarifications(new Set())

      if (isManualChange) {
        const systemMessage: Message = {
          id: `system-${Date.now()}`,
          type: "ai",
          content: persona
            ? `Switched to ${persona.name} persona. Conversation history cleared.\n\n${persona.description}`
            : "Switched to Default Mode. Full tool access restored.",
          timestamp: Date.now()
        }
        setMessages([systemMessage])
      }

      logger.log("[AISearchBar] Agent persona updated successfully")
    } catch (error) {
      logger.error("[AISearchBar] Error updating agent persona:", error)
    }
  }

  const handleClearChat = async () => {
    logger.log(" [AISearchBar] Clearing chat...")

    setMessages([])

    await clearChatMessages()

    setHandledClarifications(new Set())

    const agent = await getGlobalAgent()
    await agent.clearSession()

    setPendingManualInput({ type: null })

    editorRef.current?.setContent("")

    setLastSubmittedContentJSON(null)

    setTokenUsage(null)

    setCurrentInputLength(0)

    logger.log(" [AISearchBar] Chat cleared (including session storage)")
  }

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

          logger.log(
            ` [Token Usage] ${usage.usage}/${usage.quota} tokens (${usage.percentage.toFixed(1)}% used) - ${(usage.quota - usage.usage).toFixed(0)} remaining`
          )

          if (usage.percentage >= 80) {
            logger.warn(
              ` [Token Warning] Approaching token limit! ${usage.percentage.toFixed(1)}% used`
            )
          }
        }
      }
    } catch (error) {
      logger.error("Failed to check token usage:", error)
    }
  }

  const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4)
  }

  const validateInputSize = (
    inputText: string
  ): {
    valid: boolean
    reason?: string
    needsCompaction?: boolean
    compactionThreshold?: number
  } => {
    const estimatedInputTokens = estimateTokens(inputText)
    const MAX_INPUT_TOKENS = 2000
    const COMPACTION_THRESHOLD = 0.7

    if (estimatedInputTokens > MAX_INPUT_TOKENS) {
      return {
        valid: false,
        reason: `Input too long (~${estimatedInputTokens} tokens). Please limit to ${MAX_INPUT_TOKENS} tokens (~${MAX_INPUT_TOKENS * 4} characters).`
      }
    }

    if (tokenUsage) {
      const currentUsagePercent = tokenUsage.usage / tokenUsage.quota
      const projectedTotal = tokenUsage.usage + estimatedInputTokens + 500

      if (currentUsagePercent >= COMPACTION_THRESHOLD) {
        logger.log(
          ` [Token Management] Session at ${(currentUsagePercent * 100).toFixed(1)}% - auto-compaction recommended`
        )
        return {
          valid: true,
          needsCompaction: true,
          compactionThreshold: currentUsagePercent
        }
      }

      if (projectedTotal > tokenUsage.quota * 1.2) {
        return {
          valid: false,
          reason: `Input too large for current session. Try a shorter message or start a new chat.`
        }
      }
    }

    return { valid: true }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    const query = editorRef.current?.getText()?.trim() || ""
    const contentJSON = editorRef.current?.getJSON()

    const validation = validateInputSize(query)
    if (!validation.valid) {
      logger.warn("Input validation failed:", validation.reason)

      const errorMessage: Message = {
        id: `ai-validation-error-${Date.now()}`,
        type: "ai",
        content: ` ${validation.reason}`,
        timestamp: Date.now()
      }
      setMessages((prev) => [...prev, errorMessage])

      editorRef.current?.setContent("")
      setCurrentInputLength(0)

      return
    }

    if (validation.needsCompaction) {
      const compactionPercent = (
        (validation.compactionThreshold || 0) * 100
      ).toFixed(1)
      logger.log(
        ` [Auto-Compaction] Session at ${compactionPercent}% usage - compacting now...`
      )

      const compactionNotice: Message = {
        id: `compaction-notice-${Date.now()}`,
        type: "system",
        content: `Optimizing conversation history (${compactionPercent}% capacity used)...`,
        timestamp: Date.now()
      }
      setMessages((prev) => [...prev, compactionNotice])

      try {
        const agent = await getGlobalAgent()
        await agent.rotateSessionWithSummary()

        const successMessage: Message = {
          id: `compaction-success-${Date.now()}`,
          type: "system",
          content: `Session optimized! Your conversation context has been preserved. Continuing...`,
          timestamp: Date.now()
        }
        setMessages((prev) => [...prev, successMessage])

        logger.log(
          ` [Auto-Compaction] Session compacted successfully. Ready to continue.`
        )

        const { getSessionTokenUsage } = await import(
          "~services/gemini-nano-service"
        )
        const sessionId = agent.getSessionId()
        if (sessionId) {
          const newUsage = getSessionTokenUsage(sessionId)
          if (newUsage) {
            setTokenUsage(newUsage)
            logger.log(
              ` [Token Usage] After compaction: ${newUsage.usage}/${newUsage.quota} tokens (${newUsage.percentage.toFixed(1)}%)`
            )
          }
        }
      } catch (error) {
        logger.error(` [Auto-Compaction] Failed:`, error)

        const fallbackMessage: Message = {
          id: `compaction-fallback-${Date.now()}`,
          type: "system",
          content: `Session reset to free up space. Previous context cleared.`,
          timestamp: Date.now()
        }
        setMessages((prev) => [...prev, fallbackMessage])

        try {
          const agent = await getGlobalAgent()
          await agent.clearSession()

          const { getSessionTokenUsage } = await import(
            "~services/gemini-nano-service"
          )
          const sessionId = agent.getSessionId()
          if (sessionId) {
            const newUsage = getSessionTokenUsage(sessionId)
            if (newUsage) {
              setTokenUsage(newUsage)
            }
          }
        } catch (clearError) {
          logger.error(` [Session Clear] Failed:`, clearError)
        }
      }
    }

    if (query && onSearch && !isSearching) {
      setLastSubmittedContentJSON(contentJSON)

      if (pendingManualInput.type && pendingManualInput.pendingNoteData) {
        logger.log("Processing manual input:", pendingManualInput.type, query)

        if (pendingManualInput.type === "category") {
          await handleClarificationOption(
            "select_category",
            query,
            pendingManualInput.pendingNoteData
          )
        } else if (pendingManualInput.type === "title") {
          await handleClarificationOption(
            "use_manual_title",
            query,
            pendingManualInput.pendingNoteData
          )
        }

        setPendingManualInput({ type: null })
        editorRef.current?.setContent("")
        return
      }

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        type: "user",
        content: query,
        timestamp: Date.now()
      }

      setMessages((prev) => [...prev, userMessage])
      editorRef.current?.setContent("")
      setCurrentInputLength(0)
      setIsSearching(true)

      const streamingMessageId = `ai-streaming-${Date.now()}`
      const streamingMessage: Message = {
        id: streamingMessageId,
        type: "ai",
        content: "",
        timestamp: Date.now()
      }
      setMessages((prev) => [...prev, streamingMessage])

      try {
        const conversationHistory = messages
          .filter((m) => m.type === "user" || m.type === "ai")
          .map((m) => ({
            role: m.type === "user" ? "user" : "assistant",
            content: m.content
          }))

        conversationHistory.push({ role: "user", content: query })

        let accumulatedText = ""
        let isFirstChunk = true
        let didReceiveChunks = false
        const handleStreamChunk = (chunk: string) => {
          if (isFirstChunk) {
            logger.log(` [Streaming] First chunk received, starting stream`)
            setIsStreaming(true)
            isFirstChunk = false
            didReceiveChunks = true
          }

          accumulatedText += chunk
          logger.log(
            ` [Streaming] Chunk received (${chunk.length} chars), total: ${accumulatedText.length}`
          )

          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamingMessageId
                ? { ...m, content: accumulatedText }
                : m
            )
          )
        }

        const aiResponse = await onSearch(
          query,
          conversationHistory,
          handleStreamChunk
        )

        setIsStreaming(false)

        if (didReceiveChunks) {
          setMessages((prev) => prev.filter((m) => m.id !== streamingMessageId))
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== streamingMessageId))
        }

        if (
          typeof aiResponse === "object" &&
          ("aiResponse" in aiResponse || "referenceNotes" in aiResponse)
        ) {
          let fullReferenceNotes: Note[] = []
          if (
            aiResponse.referenceNotes &&
            aiResponse.referenceNotes.length > 0
          ) {
            logger.log("Fetching reference notes:", aiResponse.referenceNotes)
            const { getNote } = await import("~services/db-service")
            const notePromises = aiResponse.referenceNotes.map((noteId) =>
              getNote(noteId)
            )
            const notes = await Promise.all(notePromises)
            fullReferenceNotes = notes.filter(
              (note): note is Note => note !== null
            )
            logger.log("Fetched full reference notes:", fullReferenceNotes)
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

          logger.log(
            " [AISearchBar] Creating AI message with clarifications:",
            {
              hasClarificationOptions: !!aiResponse.clarificationOptions,
              clarificationCount: aiResponse.clarificationOptions?.length || 0,
              clarificationOptions: aiResponse.clarificationOptions,
              messageId: aiMessage.id
            }
          )

          setMessages((prev) => [...prev, aiMessage])

          if (aiResponse.needsClarification) {
            setIsInputDisabled(true)
          }

          if (enableInsertMode && !aiResponse.needsClarification) {
            setShowInsertButton(true)
          }

          if (aiResponse.noteCreated && onNoteCreated) {
            logger.log("Note created, calling onNoteCreated callback")
            onNoteCreated()
          }

          await checkTokenUsage()
        } else {
          const aiMessage: Message = {
            id: `ai-${Date.now()}`,
            type: "ai",
            content:
              typeof aiResponse === "string" ? aiResponse : String(aiResponse),
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, aiMessage])

          if (enableInsertMode) {
            setShowInsertButton(true)
          }

          await checkTokenUsage()
        }
      } catch (error) {
        logger.error("Search error:", error)

        setMessages((prev) => prev.filter((m) => m.id !== streamingMessageId))

        const errorMessage: Message = {
          id: `ai-error-${Date.now()}`,
          type: "ai",
          content: "Sorry, I couldn't process your request. Please try again.",
          timestamp: Date.now()
        }
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setIsSearching(false)
        setIsStreaming(false)
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
    logger.log(`[${callId}] Clarification option selected:`, {
      action,
      value,
      pendingNoteData,
      messageId
    })

    if (messageId) {
      setHandledClarifications((prev) => new Set(prev).add(messageId))
    }

    if (!pendingNoteData) {
      logger.error(`[${callId}] No pending note data found`)
      setIsInputDisabled(false)
      return
    }

    if (isSearching) {
      logger.warn(
        `[${callId}] Already processing clarification, ignoring duplicate call`
      )
      return
    }

    logger.log(`[${callId}] Setting isSearching to true`)
    setIsSearching(true)

    try {
      const { generateTitle, generateCategory } = await import(
        "~services/ai-service"
      )
      const { addNote } = await import("~services/db-service")

      let finalTitle = pendingNoteData.title || ""
      let finalCategory = pendingNoteData.category || ""
      const noteContent = pendingNoteData.content || ""

      switch (action) {
        case "cancel_note_creation": {
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

          setPendingManualInput({ type: null })

          setIsSearching(false)
          setIsInputDisabled(false)
          return
        }

        case "auto_generate_both": {
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

          const [generatedTitle, generatedCategory] = await Promise.all([
            generateTitle("", noteContent),
            generateCategory(noteContent)
          ])

          finalTitle = generatedTitle
          finalCategory = generatedCategory

          setMessages((prev) => prev.filter((m) => m.id !== loadingMessage.id))

          const confirmMessage: Message = {
            id: `ai-${Date.now()}`,
            type: "ai",
            content: `Great! I've generated:\n Title: "${finalTitle}"\n Category: "${finalCategory}"\n\nCreating your note now...`,
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, confirmMessage])

          break
        }

        case "start_manual_flow": {
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: "user",
            content: " I'll choose manually",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, userMessage])

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

          setMessages((prev) =>
            prev.filter((msg) => msg.id !== loadingMessage.id)
          )

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

          setMessages((prev) =>
            prev.filter((msg) => msg.id !== loadingMessage.id)
          )

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
          finalCategory = value
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: "user",
            content: ` ${value}`,
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, userMessage])

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
          finalTitle = value
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: "user",
            content: ` "${value}"`,
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, userMessage])

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
          logger.log(`[${callId}] Organization confirmation:`, value)

          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: "user",
            content: value.confirmed ? " Yes, move it" : " No, keep it here",
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, userMessage])

          const { getGlobalAgent } = await import("~services/langchain-agent")
          const agent = await getGlobalAgent()

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

          if (parsedResult.action === "moved" && onNotesChange) {
            await onNotesChange()
          }

          return
        }

        default:
          logger.warn("Unknown clarification action:", action)
          setIsInputDisabled(false)
          setIsSearching(false)
          return
      }

      if (finalTitle && finalCategory && noteContent) {
        const noteCreationId = `note-${Date.now()}`
        logger.log(`[${callId}] [${noteCreationId}] Creating note with:`, {
          finalTitle,
          finalCategory,
          noteContent: noteContent.substring(0, 100) + "..."
        })

        const saveStartTime = performance.now()
        logger.log(
          `[${noteCreationId}] [AI Chat] Creating new note via agent...`
        )

        const embeddingStartTime = performance.now()
        const { generateEmbedding } = await import("~services/ai-service")
        const embedding = await generateEmbedding(noteContent)
        const embeddingTime = performance.now() - embeddingStartTime
        logger.log(
          ` [AI Chat] Embedding generation: ${embeddingTime.toFixed(2)}ms (${embedding.length} dimensions)`
        )

        let sourceUrl: string | undefined
        try {
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          sourceUrl = tabs[0]?.url
        } catch (e) {
          logger.warn("Could not get tab URL:", e)
        }

        let contentJSONString: string
        if (lastSubmittedContentJSON && noteContent) {
          logger.log(" Extracting relevant portion from rich content JSON...")

          const fullMarkdown = tiptapToMarkdown(lastSubmittedContentJSON)

          if (
            fullMarkdown.includes(noteContent) &&
            fullMarkdown.length > noteContent.length
          ) {
            logger.log(
              " Agent extracted partial content, filtering TipTap nodes..."
            )

            const filteredNodes: any[] = []
            let accumulatedMarkdown = ""

            for (const node of lastSubmittedContentJSON.content || []) {
              const nodeMarkdown = tiptapToMarkdown({
                type: "doc",
                content: [node]
              })

              if (noteContent.includes(nodeMarkdown.trim())) {
                filteredNodes.push(node)
                accumulatedMarkdown += nodeMarkdown + "\n"

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
              logger.log(
                ` Filtered to ${filteredNodes.length} nodes (removed prompt)`
              )
            } else {
              contentJSONString = JSON.stringify(lastSubmittedContentJSON)
              logger.log(" Filtering failed, using full content")
            }
          } else {
            logger.log(" Content matches exactly, using full rich JSON")
            contentJSONString = JSON.stringify(lastSubmittedContentJSON)
          }
        } else {
          logger.log(" No rich content found, converting plain text to JSON")
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

        const messageStartTime = performance.now()
        const response = await chrome.runtime.sendMessage({
          type: "SAVE_NOTE",
          data: {
            title: finalTitle,
            content: contentJSONString,
            contentPlaintext: noteContent,
            category: finalCategory,
            sourceUrl,
            embedding
          }
        })
        const messageTime = performance.now() - messageStartTime
        logger.log(
          ` [AI Chat] Background processing (encrypt + DB): ${messageTime.toFixed(2)}ms`
        )

        if (!response.success) {
          throw new Error(response.error || "Failed to create note")
        }

        const totalTime = performance.now() - saveStartTime
        logger.log(` [AI Chat] TOTAL save time: ${totalTime.toFixed(2)}ms`)
        logger.log(
          ` [AI Chat] Breakdown: Embedding=${embeddingTime.toFixed(2)}ms, Background=${messageTime.toFixed(2)}ms`
        )

        const successMessage: Message = {
          id: `ai-${Date.now()}`,
          type: "ai",
          content: ` Note created successfully!\n\n Title: "${finalTitle}"\n Category: ${finalCategory}`,
          timestamp: Date.now()
        }
        setMessages((prev) => [...prev, successMessage])

        setLastSubmittedContentJSON(null)

        if (onNoteCreated) {
          onNoteCreated()
        }

        const noteId = response.note?.id
        if (noteId) {
          logger.log(
            `[${callId}] Running organize_note tool for newly created note:`,
            noteId
          )

          try {
            const { organizeNoteTool } = await import(
              "~services/langchain-tools"
            )

            const organizeResult = await organizeNoteTool.func({
              noteId: noteId
            })

            const organizeData = JSON.parse(organizeResult)
            logger.log(`[${callId}] Organize result:`, organizeData)

            if (
              organizeData.needsReorganization &&
              organizeData.suggestedCategory
            ) {
              logger.log(
                `[${callId}] Reorganization suggested:`,
                organizeData.suggestedCategory
              )

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
              setIsInputDisabled(true)
              setIsSearching(false)
              return
            } else {
              logger.log(
                `[${callId}] No reorganization needed or no similar notes found`
              )
            }
          } catch (error) {
            logger.error(`[${callId}] Error running organize_note:`, error)
          }
        }

        setIsInputDisabled(false)
      }
    } catch (error) {
      logger.error("Error handling clarification:", error)
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className={`plasmo-flex plasmo-flex-col plasmo-h-full ${className}`}>
      {}
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-py-2 plasmo-px-3 plasmo-border-b plasmo-border-slate-200">
        {}
        <div
          className={`plasmo-flex ${enableInsertMode ? "plasmo-flex-row plasmo-items-center" : "plasmo-flex-col"} plasmo-gap-1`}>
          {}
          <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
            <div className="plasmo-flex-shrink-0 plasmo-w-6 plasmo-h-6">
              <DotLottieReact
                src="https://lottie.host/523463c6-9440-4e42-bc0a-318978a9b8a2/S2YUnZFAfy.lottie"
                loop
                autoplay
              />
            </div>
            <span
              className={`${enableInsertMode ? "plasmo-text-xs" : "plasmo-text-[8px]"} plasmo-font-medium plasmo-text-slate-500 plasmo-uppercase plasmo-tracking-wider`}>
              Mind Keep
            </span>
            {}
            {onStartTour && (
              <button
                onClick={onStartTour}
                className="plasmo-p-0.5 plasmo-rounded plasmo-text-slate-400 hover:plasmo-text-slate-600 hover:plasmo-bg-slate-100 plasmo-transition-colors"
                title="Show tour">
                <svg
                  className="plasmo-w-3.5 plasmo-h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path
                    d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line
                    x1="12"
                    y1="17"
                    x2="12.01"
                    y2="17"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>

          {}
          {!enableInsertMode && (
            <div className="plasmo-flex plasmo-flex-col plasmo-gap-0.5">
              <span className="plasmo-text-base plasmo-font-light plasmo-text-slate-700">
                {greeting}!
              </span>
              <span className="plasmo-text-base plasmo-font-normal plasmo-text-slate-800">
                May I help you with anything?
              </span>
            </div>
          )}
        </div>

        {}
        {messages.length > 0 && (
          <div className="plasmo-flex-shrink-0 plasmo-flex plasmo-items-center plasmo-gap-2">
            {}
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

            {}
            {!enableInsertMode && (
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
            )}
          </div>
        )}
      </div>

      {}
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
            {}
          </div>
        </div>
      )}

      {}
      {messages.length > 0 && isChatExpanded && (
        <div className="plasmo-flex-1 plasmo-overflow-y-auto plasmo-overflow-x-hidden plasmo-no-visible-scrollbar plasmo-space-y-4 plasmo-px-4 plasmo-py-4 plasmo-max-h-[500px] plasmo-bg-white/10 plasmo-backdrop-blur-lg plasmo-rounded-2xl plasmo-border plasmo-border-white/30 plasmo-mb-4">
          {messages
            .filter((message) => {
              if (message.type === "ai" && !message.content.trim()) {
                return false
              }
              return true
            })

            .filter((_, index, arr) => {
              if (enableInsertMode) {
                const lastAiIndex = arr
                  .map((m, i) => ({ m, i }))
                  .reverse()
                  .find(({ m }) => m.type === "ai")?.i
                return index === lastAiIndex
              }
              return true
            })
            .map((message) => {
              const isExpanded = expandedMessages.has(message.id)
              const isSystemMessage = message.type === "system"

              if (isSystemMessage) {
                return (
                  <div
                    key={message.id}
                    className="plasmo-flex plasmo-justify-center plasmo-my-2">
                    <div className="plasmo-px-4 plasmo-py-2 plasmo-rounded-full plasmo-bg-blue-50/80 plasmo-backdrop-blur-md plasmo-text-blue-700 plasmo-border plasmo-border-blue-200/50 plasmo-text-xs plasmo-font-medium plasmo-shadow-sm">
                      {message.content}
                    </div>
                  </div>
                )
              }

              return (
                <div key={message.id} className="plasmo-space-y-2">
                  <div
                    className={`plasmo-flex ${
                      message.type === "user"
                        ? "plasmo-justify-end"
                        : "plasmo-justify-start"
                    }`}>
                    <div
                      className={`plasmo-px-4 plasmo-py-3 plasmo-rounded-2xl plasmo-shadow-sm plasmo-max-w-[85%] plasmo-break-words plasmo-overflow-hidden ${
                        message.type === "user"
                          ? "plasmo-bg-gradient-to-br plasmo-from-gray-50 plasmo-via-gray-100/80 plasmo-to-gray-100 plasmo-text-slate-900 plasmo-border plasmo-border-gray-200/50"
                          : "plasmo-bg-gradient-to-br plasmo-from-white plasmo-via-blue-50/30 plasmo-to-purple-50/20 plasmo-backdrop-blur-md plasmo-text-slate-900 plasmo-border plasmo-border-slate-200/50"
                      }`}>
                      {message.type === "user" ? (
                        <div className="plasmo-space-y-2">
                          <div
                            className={`plasmo-text-sm plasmo-text-slate-900 plasmo-break-words plasmo-overflow-wrap-anywhere ${
                              !isExpanded
                                ? "plasmo-line-clamp-2 plasmo-overflow-hidden"
                                : "plasmo-whitespace-pre-wrap"
                            }`}
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: isExpanded ? "unset" : 2,
                              WebkitBoxOrient: "vertical",
                              overflow: isExpanded ? "visible" : "hidden",
                              wordBreak: "break-word"
                            }}>
                            {message.content}
                          </div>
                          {message.content.length > 100 && (
                            <button
                              onClick={() => {
                                setExpandedMessages((prev) => {
                                  const newSet = new Set(prev)
                                  if (isExpanded) {
                                    newSet.delete(message.id)
                                  } else {
                                    newSet.add(message.id)
                                  }
                                  return newSet
                                })
                              }}
                              className="plasmo-text-xs plasmo-text-slate-500 hover:plasmo-text-slate-700 plasmo-transition-colors">
                              {isExpanded ? "Show less" : "Show more"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="plasmo-relative plasmo-group">
                          <MarkdownRenderer content={message.content} />

                          {}
                          <button
                            onClick={() =>
                              handleCopyMessage(message.id, message.content)
                            }
                            className="plasmo-absolute plasmo-top-2 plasmo-right-2 plasmo-p-1.5 plasmo-rounded-md plasmo-bg-white/80 hover:plasmo-bg-white plasmo-border plasmo-border-slate-200 plasmo-shadow-sm plasmo-opacity-0 group-hover:plasmo-opacity-100 plasmo-transition-all plasmo-duration-200"
                            title={
                              copiedMessageId === message.id
                                ? "Copied!"
                                : "Copy response"
                            }>
                            {copiedMessageId === message.id ? (
                              <svg
                                className="plasmo-w-3.5 plasmo-h-3.5 plasmo-text-green-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2.5}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="plasmo-w-3.5 plasmo-h-3.5 plasmo-text-slate-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {}
                  {message.clarificationOptions &&
                    message.clarificationOptions.length > 0 &&
                    !handledClarifications.has(message.id) && (
                      <div className="plasmo-flex plasmo-justify-start">
                        <div className="plasmo-max-w-[80%] plasmo-space-y-2">
                          <div className="plasmo-text-xs plasmo-font-light plasmo-text-slate-600 plasmo-pl-2">
                            Choose an option:
                          </div>
                          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2">
                            {message.clarificationOptions.map((option, idx) => {
                              if (idx === 0) {
                                logger.log(
                                  " [AISearchBar] Rendering clarification buttons for message:",
                                  {
                                    messageId: message.id,
                                    optionCount:
                                      message.clarificationOptions.length,
                                    isHandled: handledClarifications.has(
                                      message.id
                                    ),
                                    options: message.clarificationOptions
                                  }
                                )
                              }
                              return (
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
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                  {}
                  {message.referenceNotes &&
                    message.referenceNotes.length > 0 && (
                      <ReferenceNotesSection
                        notes={message.referenceNotes}
                        onNoteClick={onNoteClick}
                      />
                    )}
                </div>
              )
            })}
          {}
          {isSearching && !isStreaming && (
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

      {}
      <form onSubmit={handleSubmit} className="plasmo-mt-auto">
        {}
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
          {}
          <div
            className="plasmo-w-full plasmo-overflow-y-auto plasmo-no-visible-scrollbar"
            style={{ minHeight: "2.5em", maxHeight: maxInputHeight }}
            data-tour="ai-search-input">
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
                const currentText = editorRef.current?.getText() || ""
                setCurrentInputLength(currentText.length)

                if (
                  enableInsertMode &&
                  showInsertButton &&
                  currentText.length > 0
                ) {
                  setShowInsertButton(false)
                }
              }}
            />
          </div>

          {}
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-gap-3 plasmo-pt-2 plasmo-border-t plasmo-border-slate-100">
            {}
            <div className="plasmo-flex-shrink-0" data-tour="persona-selector">
              <PersonaSelector
                onPersonaChange={handlePersonaChange}
                onInitializationChange={setIsPersonaInitializing}
                onManageClick={onManagePersonas}
                openUpward={personaDropdownUpward}
              />
            </div>

            {}
            <button
              type={showInsertButton && enableInsertMode ? "button" : "submit"}
              onClick={
                showInsertButton && enableInsertMode && onInsert
                  ? () => {
                      const lastAiMessage = messages
                        .slice()
                        .reverse()
                        .find((m) => m.type === "ai")
                      if (lastAiMessage) {
                        onInsert(lastAiMessage.content)
                      }
                    }
                  : undefined
              }
              className="plasmo-flex-shrink-0 plasmo-px-3 plasmo-py-1.5 plasmo-text-white plasmo-rounded-lg plasmo-flex plasmo-items-center plasmo-gap-1.5 plasmo-justify-center plasmo-bg-slate-900 hover:plasmo-bg-slate-700 plasmo-transition-colors disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed"
              title={
                showInsertButton && enableInsertMode
                  ? "Insert to page"
                  : isPersonaInitializing
                    ? "Loading persona..."
                    : currentInputLength > 8000
                      ? "Input too large (max 8000 chars)"
                      : tokenUsage && tokenUsage.percentage >= 70
                        ? `Session at ${tokenUsage.percentage.toFixed(0)}% capacity - will auto-optimize`
                        : "Send (Enter)"
              }
              disabled={
                isPersonaInitializing ||
                isSearching ||
                isInputDisabled ||
                currentInputLength > 8000
              }
              data-tour="insert-button">
              {showInsertButton && enableInsertMode ? (
                <>
                  <span className="plasmo-text-xs plasmo-font-medium">
                    Insert
                  </span>
                  <span className="plasmo-text-[10px] plasmo-opacity-80">
                    ↵
                  </span>
                </>
              ) : (
                <>
                  <span className="plasmo-text-xs plasmo-font-medium">
                    Send
                  </span>
                  <svg
                    className="plasmo-w-3 plasmo-h-3"
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
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
