import { useEffect, useRef, useState } from "react"

import "~style.css"

import { AISearchBar } from "~components/AISearchBar"
import { AIStatusBanner } from "~components/AIStatusBanner"
import { CategoryFilter } from "~components/CategoryFilter"
import { Header } from "~components/Header"
import { NoteEditor, type RichTextEditorRef } from "~components/NoteEditor"
import { NotesList } from "~components/NotesList"
import { PersonaManager } from "~components/PersonaManager"
import { SearchBar } from "~components/SearchBar"
import { generateEmbedding, generateTitle } from "~services/ai-service"
import {
  deleteNote,
  getAllCategories,
  getAllNotes,
  searchNotesByTitle,
  type Note
} from "~services/db-service"
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
          "🎯 [Auto Title] No title provided, generating automatically..."
        )
        const titleGenerationStart = performance.now()

        try {
          finalTitle = await generateTitle("", contentPlaintext)
          console.log(
            `✅ [Auto Title] Generated: "${finalTitle}" in ${(performance.now() - titleGenerationStart).toFixed(2)}ms`
          )

          // Update the UI to show the generated title
          setNoteTitle(finalTitle)
        } catch (error) {
          console.error("❌ [Auto Title] Generation failed:", error)
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
        console.log("✏️ [UI Update] Updating existing note:", editingNote.id)

        // Generate new embedding for updated content (from plaintext)
        const embeddingStartTime = performance.now()
        const embedding = await generateEmbedding(contentPlaintext)
        const embeddingTime = performance.now() - embeddingStartTime
        console.log(
          `⏱️ [UI Update] Embedding generation: ${embeddingTime.toFixed(2)}ms (${embedding.length} dimensions)`
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
          `⏱️ [UI Update] Background processing (encrypt + DB): ${messageTime.toFixed(2)}ms`
        )

        if (!response.success) {
          throw new Error(response.error || "Update failed")
        }

        const totalTime = performance.now() - updateStartTime
        console.log(
          `⏱️ [UI Update] TOTAL update time: ${totalTime.toFixed(2)}ms`
        )
        console.log(
          `📊 [UI Update] Breakdown: Embedding=${embeddingTime.toFixed(2)}ms, Background=${messageTime.toFixed(2)}ms`
        )
      } else {
        // For new notes, generate embedding here (in DOM context with full Web APIs)
        const saveStartTime = performance.now()
        console.log("📝 [UI Save] Creating new note...")

        // Step 1: Generate embedding from plaintext content
        const embeddingStartTime = performance.now()
        const embedding = await generateEmbedding(contentPlaintext)
        const embeddingTime = performance.now() - embeddingStartTime
        console.log(
          `⏱️ [UI Save] Embedding generation: ${embeddingTime.toFixed(2)}ms (${embedding.length} dimensions)`
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
          `🚀 [UI Save ${saveId}] Sending SAVE_NOTE message to background`
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
          `⏱️ [UI Save] Background processing (encrypt + DB): ${messageTime.toFixed(2)}ms`
        )

        if (!response.success) {
          throw new Error(response.error || "Save failed")
        }

        const totalTime = performance.now() - saveStartTime
        console.log(`⏱️ [UI Save] TOTAL save time: ${totalTime.toFixed(2)}ms`)
        console.log(
          `📊 [UI Save] Breakdown: Embedding=${embeddingTime.toFixed(2)}ms, Background=${messageTime.toFixed(2)}ms`
        )
      }

      console.log("Reloading data...")
      await loadData()
      clearSearchQuery()
      console.log("Switching to list view")
      setView("list")
    } catch (error) {
      console.error("❌ Error saving note:", error)
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
    console.log("🎭 [SidePanel] Switching to personas view")
    setView("personas")
  }

  const handlePersonaActivated = async (persona: Persona | null) => {
    console.log("🎭 [SidePanel] Persona activated:", persona?.name || "None")

    try {
      // Update the global agent with the new persona
      const agent = await getGlobalAgent()
      await agent.setPersona(persona) // Now async - recreates session

      console.log("🎭 [SidePanel] Global agent updated with persona")
    } catch (error) {
      console.error("🎭 [SidePanel] Error updating agent persona:", error)
    }
  }

  const handleBackToList = () => {
    console.log("📝 [SidePanel] Switching back to list view")
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
    setSearchQuery(value)
    // Auto-search as user types
    if (value.trim()) {
      setTimeout(() => {
        searchNotesByTitle(value).then(setNotes).catch(console.error)
      }, 300)
    } else {
      loadData()
    }
  }

  const handleAISearch = async (
    query: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<string | import("~services/langchain-agent").AgentResponse> => {
    const startTime = performance.now()

    try {
      console.log("🤖 [LangChain Agent] Processing query:", query)

      // Use the LangChain agent for agentic search
      const { getGlobalAgent } = await import("~services/langchain-agent")
      const agent = await getGlobalAgent()

      const response = await agent.run(query, conversationHistory)

      const totalTime = performance.now() - startTime
      console.log(`⏱️ [LangChain Agent] TOTAL time: ${totalTime.toFixed(2)}ms`)
      console.log(`📊 [LangChain Agent] Structured response:`, response)

      // Return the full response object for clarification support
      // AISearchBar will handle it appropriately
      return response
    } catch (error) {
      const totalTime = performance.now() - startTime
      console.error(
        `❌ [LangChain Agent] Failed after ${totalTime.toFixed(2)}ms:`,
        error
      )
      return "I encountered an error while searching. Please try again."
    }
  }

  // Filter notes
  const filteredNotes = notes.filter((note) => {
    const matchesCategory =
      selectedCategory === "all" || note.category === selectedCategory
    const matchesSearch =
      searchQuery === "" ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="plasmo-w-full plasmo-h-screen plasmo-bg-slate-50 plasmo-overflow-hidden">
      <div className="plasmo-h-full plasmo-flex plasmo-flex-col">
        {/* Header */}
        <Header
          onClose={handleClose}
          onPersonasClick={handlePersonasClick}
          view={view}
        />

        {/* Content */}
        <div
          className={`plasmo-flex-1 plasmo-overflow-y-auto plasmo-p-4 ${view === "personas" ? "plasmo-pb-4" : "plasmo-pb-20"}`}>
          {/* AI Status Banner - only show in list view */}
          {view === "list" && <AIStatusBanner />}

          {view === "personas" ? (
            <div className="plasmo-h-full">
              <div className="plasmo-mb-4">
                <button
                  onClick={handleBackToList}
                  className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-slate-600 hover:plasmo-text-slate-900 plasmo-transition-colors">
                  <svg
                    className="plasmo-w-4 plasmo-h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Back to Notes
                </button>
              </div>
              <PersonaManager onPersonaActivated={handlePersonaActivated} />
            </div>
          ) : view === "list" ? (
            <>
              {/* Search and Filters */}
              <div className="plasmo-mb-4 plasmo-space-y-3">
                <SearchBar
                  value={searchQuery}
                  onChange={handleSearchInput}
                  onClear={clearSearchQuery}
                  onSearch={handleSearch}
                />

                <CategoryFilter
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onCategoryChange={(category) => {
                    setSelectedCategory(category)
                    clearSearchQuery()
                  }}
                />

                <button
                  onClick={handleCreateNew}
                  disabled={loading}
                  className="plasmo-w-full plasmo-px-4 plasmo-py-2 plasmo-bg-green-500 plasmo-text-white plasmo-rounded-lg plasmo-text-sm plasmo-font-medium hover:plasmo-bg-green-600 plasmo-transition-colors disabled:plasmo-opacity-50">
                  + Create New Note
                </button>
              </div>

              {/* Notes List */}
              <NotesList
                notes={filteredNotes}
                loading={loading}
                onEdit={handleEditNote}
                onDelete={handleDeleteNote}
                onCreateNew={handleCreateNew}
              />
            </>
          ) : (
            /* Editor View */
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
          )}
        </div>

        {/* Fixed Bottom Search Bar - hide in personas view */}
        {view !== "personas" && (
          <div className="plasmo-fixed plasmo-bottom-0 plasmo-left-0 plasmo-right-0 plasmo-bg-white plasmo-border-t plasmo-border-slate-200 plasmo-shadow-lg plasmo-p-4">
            <AISearchBar
              placeholder="Ask me anything..."
              onSearch={handleAISearch}
              onNoteCreated={loadData}
              onNotesChange={loadData}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default SidePanel
