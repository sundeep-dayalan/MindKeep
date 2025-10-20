import React from "react"

import {
  RichTextEditor,
  type RichTextEditorRef
} from "~components/RichTextEditor"
import type { Note } from "~services/db-service"
import type { AgentResponse } from "~services/langchain-agent"

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
  onSearch?: (query: string) => Promise<string | AgentResponse>
  onNoteCreated?: () => void // Callback when a note is successfully created
  className?: string
}

// Reference Notes Component - Collapsible chip design
function ReferenceNotesSection({ notes }: { notes: Note[] }) {
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

        {/* Expanded View - Note Chips */}
        {isExpanded && (
          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2 plasmo-mt-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="plasmo-group plasmo-relative plasmo-px-3 plasmo-py-1.5 plasmo-bg-white plasmo-border plasmo-border-slate-200 hover:plasmo-border-blue-300 plasmo-rounded-full plasmo-shadow-sm hover:plasmo-shadow-md plasmo-transition-all plasmo-cursor-pointer">
                <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
                  <span className="plasmo-text-xs plasmo-font-medium plasmo-text-slate-800 plasmo-max-w-[200px] plasmo-truncate">
                    {note.title}
                  </span>
                  <span className="plasmo-px-2 plasmo-py-0.5 plasmo-bg-blue-50 plasmo-text-blue-700 plasmo-text-[10px] plasmo-rounded-full plasmo-flex-shrink-0">
                    {note.category}
                  </span>
                </div>

                {/* Tooltip on hover */}
                <div className="plasmo-hidden group-hover:plasmo-block plasmo-absolute plasmo-left-0 plasmo-top-full plasmo-mt-2 plasmo-z-10 plasmo-w-72 plasmo-p-3 plasmo-bg-white plasmo-border plasmo-border-slate-200 plasmo-rounded-lg plasmo-shadow-lg">
                  <div className="plasmo-flex plasmo-items-start plasmo-justify-between plasmo-gap-2 plasmo-mb-2">
                    <h4 className="plasmo-text-sm plasmo-font-semibold plasmo-text-slate-800">
                      {note.title}
                    </h4>
                    <span className="plasmo-px-2 plasmo-py-0.5 plasmo-bg-blue-50 plasmo-text-blue-700 plasmo-text-xs plasmo-rounded-full plasmo-flex-shrink-0">
                      {note.category}
                    </span>
                  </div>
                  <p className="plasmo-text-xs plasmo-text-slate-600 plasmo-line-clamp-3 plasmo-mb-2">
                    {note.contentPlaintext}
                  </p>
                  <div className="plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-pt-2 plasmo-border-t plasmo-border-slate-100">
                    <span className="plasmo-text-xs plasmo-text-slate-400">
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </span>
                    {note.sourceUrl && (
                      <a
                        href={note.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="plasmo-text-xs plasmo-text-blue-500 hover:plasmo-text-blue-700 plasmo-flex plasmo-items-center plasmo-gap-1">
                        <svg
                          className="plasmo-w-3 plasmo-h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                        Source
                      </a>
                    )}
                  </div>
                </div>
              </div>
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
  className = ""
}: AISearchBarProps) {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [isChatExpanded, setIsChatExpanded] = React.useState(true)
  const [isInputDisabled, setIsInputDisabled] = React.useState(false)

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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
      setIsSearching(true)

      try {
        const aiResponse = await onSearch(query)

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
    pendingNoteData?: AgentResponse["pendingNoteData"]
  ) => {
    const callId = `${action}-${Date.now()}`
    console.log(`[${callId}] Clarification option selected:`, {
      action,
      value,
      pendingNoteData
    })

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
        case "auto_generate_both": {
          // User chose to auto-generate both title and category
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: "user",
            content: "✨ Auto-generate both title and category",
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
            content: `Great! I've generated:\n📝 Title: "${finalTitle}"\n📁 Category: "${finalCategory}"\n\nCreating your note now...`,
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
            content: "✍️ I'll choose manually",
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
            content: "🤖 Auto-generate title",
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
            content: "✍️ I'll provide a title",
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
            content: "🤖 Auto-generate category",
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
            content: `📁 ${value}`,
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
            content: "✍️ I'll provide a category",
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
            content: `📝 "${value}"`,
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
          `[${noteCreationId}] 📝 [AI Chat] Creating new note via agent...`
        )

        // Step 1: Generate embedding from plaintext content
        const embeddingStartTime = performance.now()
        const { generateEmbedding } = await import("~services/ai-service")
        const embedding = await generateEmbedding(noteContent)
        const embeddingTime = performance.now() - embeddingStartTime
        console.log(
          `⏱️ [AI Chat] Embedding generation: ${embeddingTime.toFixed(2)}ms (${embedding.length} dimensions)`
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
          console.log(
            "✨ Extracting relevant portion from rich content JSON..."
          )

          // Get the full plaintext from the stored JSON to compare
          const extractPlainTextFromJSON = (json: any): string => {
            if (!json || !json.content) return ""
            return json.content
              .map((node: any) => {
                if (node.type === "paragraph" || node.type === "heading") {
                  return node.content
                    ?.map((child: any) => child.text || "")
                    .join("")
                }
                return ""
              })
              .join("\n")
              .trim()
          }

          const fullText = extractPlainTextFromJSON(lastSubmittedContentJSON)

          // Check if noteContent is a subset of fullText (agent extracted only part)
          if (
            fullText.includes(noteContent) &&
            fullText.length > noteContent.length
          ) {
            console.log(
              "⚠️ Agent extracted partial content, filtering TipTap nodes..."
            )

            // Filter TipTap nodes to only include those that are part of noteContent
            const filteredNodes: any[] = []
            let accumulatedText = ""

            for (const node of lastSubmittedContentJSON.content || []) {
              const nodeText = extractPlainTextFromJSON({ content: [node] })

              // Check if this node is part of the extracted content
              if (noteContent.includes(nodeText.trim())) {
                filteredNodes.push(node)
                accumulatedText += nodeText + "\n"

                // Stop if we've accumulated enough content
                if (accumulatedText.trim().length >= noteContent.length) {
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
                `✅ Filtered to ${filteredNodes.length} nodes (removed prompt)`
              )
            } else {
              // Fallback: use the full content if filtering failed
              contentJSONString = JSON.stringify(lastSubmittedContentJSON)
              console.log("⚠️ Filtering failed, using full content")
            }
          } else {
            // Content matches exactly, use full JSON
            console.log("✅ Content matches exactly, using full rich JSON")
            contentJSONString = JSON.stringify(lastSubmittedContentJSON)
          }
        } else {
          // Fallback: Convert plain text to TipTap JSON format (for backward compatibility)
          console.log("⚠️ No rich content found, converting plain text to JSON")
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
          `⏱️ [AI Chat] Background processing (encrypt + DB): ${messageTime.toFixed(2)}ms`
        )

        if (!response.success) {
          throw new Error(response.error || "Failed to create note")
        }

        const totalTime = performance.now() - saveStartTime
        console.log(`⏱️ [AI Chat] TOTAL save time: ${totalTime.toFixed(2)}ms`)
        console.log(
          `📊 [AI Chat] Breakdown: Embedding=${embeddingTime.toFixed(2)}ms, Background=${messageTime.toFixed(2)}ms`
        )

        const successMessage: Message = {
          id: `ai-${Date.now()}`,
          type: "ai",
          content: `✅ Note created successfully!\n\n📝 Title: "${finalTitle}"\n📁 Category: ${finalCategory}`,
          timestamp: Date.now()
        }
        setMessages((prev) => [...prev, successMessage])

        // Clear the stored content JSON after successful save
        setLastSubmittedContentJSON(null)

        // Notify parent component to refresh notes list
        if (onNoteCreated) {
          onNoteCreated()
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
    <div
      className={`plasmo-flex plasmo-flex-col plasmo-space-y-2 ${className}`}>
      {/* Ask AI Label with Toggle */}
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-px-1">
        <div className="plasmo-flex plasmo-items-center plasmo-gap-1.5">
          <svg
            className="plasmo-w-4 plasmo-h-4 plasmo-text-slate-600"
            fill="currentColor"
            viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="plasmo-text-xs plasmo-font-medium plasmo-text-slate-600">
            Ask AI
          </span>
        </div>

        {messages.length > 0 && (
          <button
            onClick={() => setIsChatExpanded(!isChatExpanded)}
            className="plasmo-p-1 plasmo-rounded plasmo-text-slate-500 hover:plasmo-text-slate-700 hover:plasmo-bg-slate-100 plasmo-transition-colors"
            title={isChatExpanded ? "Hide chat history" : "Show chat history"}>
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

      {/* Chat Messages */}
      {messages.length > 0 && isChatExpanded && (
        <div className="plasmo-flex-1 plasmo-overflow-y-auto plasmo-space-y-3 plasmo-px-2 plasmo-py-3 plasmo-max-h-96 plasmo-bg-slate-50 plasmo-rounded-lg">
          {messages.map((message) => (
            <div key={message.id} className="plasmo-space-y-2">
              <div
                className={`plasmo-flex ${
                  message.type === "user"
                    ? "plasmo-justify-end"
                    : "plasmo-justify-start"
                }`}>
                <div
                  className={`plasmo-max-w-[80%] plasmo-px-4 plasmo-py-2 plasmo-rounded-lg ${
                    message.type === "user"
                      ? "plasmo-bg-blue-500 plasmo-text-white"
                      : "plasmo-bg-white plasmo-text-slate-700 plasmo-border plasmo-border-slate-200"
                  }`}>
                  <div className="plasmo-text-sm plasmo-whitespace-pre-wrap">
                    {message.content}
                  </div>
                </div>
              </div>

              {/* Clarification Options */}
              {message.clarificationOptions &&
                message.clarificationOptions.length > 0 && (
                  <div className="plasmo-flex plasmo-justify-start plasmo-pl-4">
                    <div className="plasmo-max-w-[80%] plasmo-space-y-2">
                      <div className="plasmo-text-xs plasmo-font-medium plasmo-text-slate-600 plasmo-pl-2">
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
                                message.pendingNoteData
                              )
                            }
                            className={`${
                              option.type === "category_pill"
                                ? "plasmo-px-3 plasmo-py-1.5 plasmo-bg-blue-50 hover:plasmo-bg-blue-100 plasmo-text-blue-700 plasmo-border plasmo-border-blue-200 hover:plasmo-border-blue-300"
                                : "plasmo-px-4 plasmo-py-2 plasmo-bg-white hover:plasmo-bg-slate-50 plasmo-text-slate-700 plasmo-border plasmo-border-slate-300 hover:plasmo-border-slate-400"
                            } plasmo-rounded-full plasmo-text-sm plasmo-font-medium plasmo-transition-all plasmo-cursor-pointer plasmo-shadow-sm hover:plasmo-shadow disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed`}>
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              {/* Reference Notes */}
              {message.referenceNotes && message.referenceNotes.length > 0 && (
                <ReferenceNotesSection notes={message.referenceNotes} />
              )}
            </div>
          ))}
          {isSearching && (
            <div className="plasmo-flex plasmo-justify-start">
              <div className="plasmo-max-w-[80%] plasmo-px-4 plasmo-py-2 plasmo-rounded-lg plasmo-bg-white plasmo-text-slate-700 plasmo-border plasmo-border-slate-200">
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
      <form onSubmit={handleSubmit}>
        <div className="plasmo-flex plasmo-items-end plasmo-gap-2 plasmo-bg-slate-50 plasmo-rounded-2xl plasmo-px-4 plasmo-py-3 plasmo-border plasmo-border-slate-200 hover:plasmo-border-slate-300 plasmo-transition-all focus-within:plasmo-border-blue-400 focus-within:plasmo-ring-2 focus-within:plasmo-ring-blue-100">
          {/* Rich Text Editor - takes full width */}
          <div className="plasmo-flex-1 plasmo-min-h-[40px] plasmo-max-h-[200px] plasmo-overflow-y-auto">
            <RichTextEditor
              ref={editorRef}
              placeholder={
                isInputDisabled
                  ? "Please select an option above..."
                  : placeholder
              }
              showToolbar={false}
              compact={true}
              onUpdate={() => {
                // Optional: could track changes if needed
              }}
            />
          </div>

          {/* Submit Button - aligned to bottom right */}
          <button
            type="submit"
            className="plasmo-flex-shrink-0 plasmo-w-8 plasmo-h-8 plasmo-bg-slate-900 plasmo-text-white plasmo-rounded-full plasmo-flex plasmo-items-center plasmo-justify-center hover:plasmo-bg-slate-800 plasmo-transition-colors disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed plasmo-mb-0.5"
            title="Send (Ctrl+Enter)"
            disabled={isSearching || isInputDisabled}>
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

        {/* Hint text for keyboard shortcuts */}
        <div className="plasmo-text-xs plasmo-text-slate-400 plasmo-mt-1 plasmo-px-2 plasmo-text-right">
          Press{" "}
          <kbd className="plasmo-px-1 plasmo-py-0.5 plasmo-bg-slate-100 plasmo-rounded plasmo-text-slate-600 plasmo-font-mono plasmo-text-xs">
            Ctrl+Enter
          </kbd>{" "}
          to send
        </div>
      </form>
    </div>
  )
}
