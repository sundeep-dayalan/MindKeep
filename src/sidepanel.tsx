import { useEffect, useRef, useState } from "react"

import "~style.css"

import { AISearchBar } from "~components/AISearchBar"
import { AIStatusBanner } from "~components/AIStatusBanner"
import { AnimatedCategoryTabs } from "~components/AnimatedCategoryTabs"
import { Header } from "~components/Header"
import { NoteEditor, type RichTextEditorRef } from "~components/NoteEditor"
import { PersonaManager } from "~components/PersonaManager"
import { generateEmbedding, generateTitle } from "~services/ai-service"
import {
  deleteNote,
  getAllCategories,
  getAllNotes,
  searchNotesByTitle,
  type Note
} from "~services/db-service"
import {
  checkAllAIServices,
  type HealthCheckStatus
} from "~services/ai-service"
import { getGlobalAgent } from "~services/langchain-agent"
import { initializeDefaultPersonas } from "~services/persona-defaults"
import type { Persona } from "~types/persona"

type View = "list" | "editor" | "personas"

function SidePanel() {
  const [view, setView] = useState<View>("list")
  const [notes, setNotes] = useState<Note[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState<HealthCheckStatus[]>([])

  // Editor state
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [noteTitle, setNoteTitle] = useState("")
  const [noteContent, setNoteContent] = useState("")
  const [noteCategory, setNoteCategory] = useState("general")

  // Add a ref to track the editor so we can update it when messages arrive
  const editorRef = useRef<RichTextEditorRef | null>(null)

  // Load notes and categories
  useEffect(() => {
    loadData()

    // Check AI availability on mount
    checkAllAIServices().then(setAiStatus)

    // Initialize default personas on first load
    initializeDefaultPersonas().catch((error) => {
      console.error("Failed to initialize default personas:", error)
    })

    // Notify background that side panel is open
    chrome.runtime.sendMessage({ type: "SIDE_PANEL_OPENED" })

    // Listen for close message from background
    const handleMessage = (
      message: any,
      sender: chrome.runtime.MessageSender
    ) => {
      if (message.type === "CLOSE_SIDE_PANEL") {
        window.close()
      } else if (message.type === "FILL_EDITOR") {
        // Handle context menu "Save to MindKeep"
        const content = message.data.content || ""
        const isHtml = message.data.isHtml || false

        // Reset editor state
        setNoteTitle("")
        setNoteCategory("general")
        setEditingNote(null)
        setView("editor")

        // Set content appropriately based on type
        if (isHtml) {
          // For HTML content, set it and let the editor render
          setNoteContent(content)
          // If editor is already mounted, update it directly
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.setContent(content)
            }
          }, 100)
        } else {
          // For plain text, just set the state
          setNoteContent(content)
        }
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [allNotes, allCategories] = await Promise.all([
        getAllNotes(),
        getAllCategories()
      ])
      setNotes(allNotes)
      setCategories(allCategories)
    } catch (error) {
      console.error("Error loading data:", error)
    }
    setLoading(false)
  }

  // Clear search and reload
  const clearSearchQuery = () => {
    setSearchQuery("")
    loadData()
  }

  const handleCreateNew = () => {
    setEditingNote(null)
    setNoteTitle("")
    setNoteContent("")
    setNoteCategory("general")
    clearSearchQuery()
    setView("editor")
  }

  const handleEditNote = (note: Note) => {
    setEditingNote(note)
    setNoteTitle(note.title)
    setNoteContent(note.content)
    setNoteCategory(note.category)
    clearSearchQuery()
    setView("editor")
  }

  const handleSaveNote = async (
    editorRef: RichTextEditorRef | null,
    finalCategory?: string
  ) => {
    const contentPlaintext = editorRef?.getText() || ""
    const contentJSON = editorRef?.getJSON()

    // Check if content exists
    if (!contentPlaintext.trim()) {
      alert("Content is required")
      return
    }

    // Use the passed category if provided, otherwise use the state category
    const categoryToSave = finalCategory || noteCategory

    setLoading(true)
    try {
      // Auto-generate title if not provided
      let finalTitle = noteTitle.trim()
      if (!finalTitle) {
        console.log(
          " [Auto Title] No title provided, generating automatically..."
        )
        const titleGenerationStart = performance.now()

        try {
          finalTitle = await generateTitle("", contentPlaintext)
          console.log(
            ` [Auto Title] Generated: "${finalTitle}" in ${(performance.now() - titleGenerationStart).toFixed(2)}ms`
          )

          // Update the UI to show the generated title
          setNoteTitle(finalTitle)
        } catch (error) {
          console.error(" [Auto Title] Generation failed:", error)
          // Fallback to a default title
          finalTitle = "Untitled Note"
          setNoteTitle(finalTitle)
        }
      }

      // Convert TipTap JSON to string for storage
      const contentJSONString = JSON.stringify(contentJSON)

      if (editingNote) {
        // For updates, generate embedding here (in DOM context with full Web APIs)
        const updateStartTime = performance.now()
        console.log(" [UI Update] Updating existing note:", editingNote.id)

        // Generate new embedding for updated content (from plaintext)
        const embeddingStartTime = performance.now()
        const embedding = await generateEmbedding(contentPlaintext)
        const embeddingTime = performance.now() - embeddingStartTime
        console.log(
          `⏱ [UI Update] Embedding generation: ${embeddingTime.toFixed(2)}ms (${embedding.length} dimensions)`
        )

        // Send update request to background script with pre-generated embedding
        const messageStartTime = performance.now()
        const response = await chrome.runtime.sendMessage({
          type: "UPDATE_NOTE",
          data: {
            id: editingNote.id,
            title: finalTitle,
            content: contentJSONString,
            contentPlaintext,
            category: categoryToSave,
            embedding
          }
        })
        const messageTime = performance.now() - messageStartTime
        console.log(
          `⏱ [UI Update] Background processing (encrypt + DB): ${messageTime.toFixed(2)}ms`
        )

        if (!response.success) {
          throw new Error(response.error || "Update failed")
        }

        const totalTime = performance.now() - updateStartTime
        console.log(
          `⏱ [UI Update] TOTAL update time: ${totalTime.toFixed(2)}ms`
        )
        console.log(
          ` [UI Update] Breakdown: Embedding=${embeddingTime.toFixed(2)}ms, Background=${messageTime.toFixed(2)}ms`
        )
      } else {
        // For new notes, generate embedding here (in DOM context with full Web APIs)
        const saveStartTime = performance.now()
        console.log(" [UI Save] Creating new note...")

        // Step 1: Generate embedding from plaintext content
        const embeddingStartTime = performance.now()
        const embedding = await generateEmbedding(contentPlaintext)
        const embeddingTime = performance.now() - embeddingStartTime
        console.log(
          `⏱ [UI Save] Embedding generation: ${embeddingTime.toFixed(2)}ms (${embedding.length} dimensions)`
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

        // Step 2: Send to background script with pre-generated embedding
        const messageStartTime = performance.now()
        const saveId = `save_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        console.log(
          ` [UI Save ${saveId}] Sending SAVE_NOTE message to background`
        )
        const response = await chrome.runtime.sendMessage({
          type: "SAVE_NOTE",
          data: {
            title: finalTitle,
            content: contentJSONString,
            contentPlaintext,
            category: categoryToSave,
            sourceUrl,
            embedding,
            _debugSaveId: saveId
          }
        })
        const messageTime = performance.now() - messageStartTime
        console.log(
          `⏱ [UI Save] Background processing (encrypt + DB): ${messageTime.toFixed(2)}ms`
        )

        if (!response.success) {
          throw new Error(response.error || "Save failed")
        }

        const totalTime = performance.now() - saveStartTime
        console.log(` [UI Save] TOTAL save time: ${totalTime.toFixed(2)}ms`)
        console.log(
          ` [UI Save] Breakdown: Embedding=${embeddingTime.toFixed(2)}ms, Background=${messageTime.toFixed(2)}ms`
        )
      }

      console.log("Reloading data...")
      await loadData()
      clearSearchQuery()
      console.log("Switching to list view")
      setView("list")
    } catch (error) {
      console.error(" Error saving note:", error)
      alert(`Failed to save note: ${error.message || error}`)
    }
    setLoading(false)
  }

  const handleDeleteNote = async (id: string) => {
    if (!confirm("Are you sure you want to delete this note?")) {
      return
    }

    setLoading(true)
    try {
      await deleteNote(id)
      await loadData()
    } catch (error) {
      console.error("Error deleting note:", error)
      alert("Failed to delete note")
    }
    setLoading(false)
  }

  const handleClose = () => {
    window.close()
  }

  const handlePersonasClick = () => {
    console.log(" [SidePanel] Switching to personas view")
    setView("personas")
  }

  const handlePersonaActivated = async (persona: Persona | null) => {
    console.log(" [SidePanel] Persona activated:", persona?.name || "None")

    try {
      // Update the global agent with the new persona
      const agent = await getGlobalAgent()
      await agent.setPersona(persona) // Now async - recreates session

      console.log(" [SidePanel] Global agent updated with persona")
    } catch (error) {
      console.error(" [SidePanel] Error updating agent persona:", error)
    }
  }

  const handleBackToList = () => {
    console.log(" [SidePanel] Switching back to list view")
    setView("list")
  }

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      setLoading(true)
      try {
        const results = await searchNotesByTitle(searchQuery)
        setNotes(results)
      } catch (error) {
        console.error("Error searching:", error)
      }
      setLoading(false)
    } else {
      loadData()
    }
  }

  // Handle search input change with auto-search
  const handleSearchInput = (value: string) => {
    console.log(" [Search] Query changed to:", value)
    setSearchQuery(value)
    // Note: Filtering is done via filteredNotes, no need for async search here
    // Just update the query and let React handle the filtering
  }

  const handleAISearch = async (
    query: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    onStreamChunk?: (chunk: string) => void
  ): Promise<string | import("~services/langchain-agent").AgentResponse> => {
    const startTime = performance.now()

    try {
      console.log(" [LangChain Agent] Processing query:", query)

      // Use the LangChain agent for agentic search (already imported at top)
      const agent = await getGlobalAgent()

      // Use streaming if callback is provided
      if (onStreamChunk) {
        console.log(" [LangChain Agent] Using streaming mode")

        let finalResponse: import("~services/langchain-agent").AgentResponse | null = null

        for await (const event of agent.runStream(query, conversationHistory)) {
          if (event.type === "chunk") {
            // Stream text chunks to UI
            onStreamChunk(event.data as string)
          } else if (event.type === "complete") {
            // Store final response
            finalResponse = event.data as import("~services/langchain-agent").AgentResponse
          }
        }

        const totalTime = performance.now() - startTime
        console.log(` [LangChain Agent] TOTAL stream time: ${totalTime.toFixed(2)}ms`)
        console.log(` [LangChain Agent] Final response:`, finalResponse)

        return finalResponse || { aiResponse: "", extractedData: null, referenceNotes: [] }
      }

      // Fallback to non-streaming mode
      const response = await agent.run(query, conversationHistory)

      const totalTime = performance.now() - startTime
      console.log(` [LangChain Agent] TOTAL time: ${totalTime.toFixed(2)}ms`)
      console.log(` [LangChain Agent] Structured response:`, response)

      // Return the full response object for clarification support
      // AISearchBar will handle it appropriately
      return response
    } catch (error) {
      const totalTime = performance.now() - startTime
      console.error(
        ` [LangChain Agent] Failed after ${totalTime.toFixed(2)}ms:`,
        error
      )
      return "I encountered an error while searching. Please try again."
    }
  }

  // Filter notes by search query only
  // Category filtering is handled by AnimatedCategoryTabs component
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      searchQuery === "" ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.contentPlaintext.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  // Debug logging for search
  if (searchQuery) {
    console.log(
      ` [Search] Query: "${searchQuery}", Total notes: ${notes.length}, Filtered: ${filteredNotes.length}`
    )
  }

  return (
    <div className="plasmo-w-full plasmo-h-screen plasmo-bg-slate-50 plasmo-overflow-hidden">
      <div className="plasmo-h-full plasmo-flex plasmo-flex-col">
        {/* Header */}
        <Header
          onClose={handleClose}
          onPersonasClick={handlePersonasClick}
          onCreateNote={handleCreateNew}
          view={view}
          searchValue={searchQuery}
          onSearchChange={handleSearchInput}
          onSearchClear={clearSearchQuery}
        />

        {/* Content */}
        <div className="plasmo-flex-1 plasmo-flex plasmo-flex-col plasmo-overflow-hidden">
          {view === "personas" ? (
            <div className="plasmo-flex-1 plasmo-overflow-y-auto plasmo-no-visible-scrollbar">
              <PersonaManager
                onPersonaActivated={handlePersonaActivated}
                onBack={handleBackToList}
              />
            </div>
          ) : view === "list" ? (
            <div className="plasmo-flex-1 plasmo-flex plasmo-flex-col plasmo-overflow-hidden plasmo-relative">
              {/* Sticky Top Section - AI Banner only */}
              <div className="plasmo-flex-shrink-0">
                {/* AI Status Banner */}
                <AIStatusBanner />
              </div>

              {/* Notes Section - Full height scrollable area */}
              <div className="plasmo-flex-1 plasmo-min-h-0">
                <AnimatedCategoryTabs
                  categories={categories}
                  notes={filteredNotes}
                  selectedCategory={selectedCategory}
                  onCategoryChange={(category) => {
                    setSelectedCategory(category)
                    clearSearchQuery()
                  }}
                  onEdit={handleEditNote}
                  onDelete={handleDeleteNote}
                  loading={loading}
                />
              </div>
            </div>
          ) : (
            /* Editor View */
            <div className="plasmo-flex-1 plasmo-overflow-y-auto plasmo-no-visible-scrollbar plasmo-p-4 plasmo-pb-8">
              <NoteEditor
                title={noteTitle}
                content={noteContent}
                category={noteCategory}
                categories={categories}
                isEditing={!!editingNote}
                loading={loading}
                onTitleChange={setNoteTitle}
                onCategoryChange={setNoteCategory}
                onSave={handleSaveNote}
                onCancel={() => setView("list")}
                externalEditorRef={editorRef}
              />
            </div>
          )}

          {/* Fixed Bottom Search Bar - hide in personas view, editor view, and when AI is not available */}
          {view !== "personas" &&
            view !== "editor" &&
            aiStatus.length > 0 &&
            aiStatus.every((service) => service.available) && (
              <div className="plasmo-fixed plasmo-bottom-0 plasmo-left-0 plasmo-right-0 plasmo-bg-transparent plasmo-backdrop-blur-xl plasmo-border-t plasmo-border-white/20 plasmo-shadow-lg plasmo-p-3 plasmo-z-50">
                <AISearchBar
                  placeholder="Ask me anything..."
                  onSearch={handleAISearch}
                  onNoteCreated={loadData}
                  onNotesChange={loadData}
                  onNoteClick={handleEditNote}
                  onManagePersonas={handlePersonasClick}
                />
              </div>
            )}
        </div>
      </div>
    </div>
  )
}

export default SidePanel
