import { useEffect, useRef, useState } from "react"

import "~style.css"

import { AISearchBar } from "~components/AISearchBar"
import { AIStatusBanner } from "~components/AIStatusBanner"
import { AnimatedCategoryTabs } from "~components/AnimatedCategoryTabs"
import { Header } from "~components/Header"
import { NoteEditor, type RichTextEditorRef } from "~components/NoteEditor"
import { PersonaManager } from "~components/PersonaManager"
import {
  checkAllAIServices,
  generateEmbedding,
  generateTitle,
  type HealthCheckStatus
} from "~services/ai-service"
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
import { logger } from "~utils/logger"

type View = "list" | "editor" | "personas"

function SidePanel() {
  const [view, setView] = useState<View>("list")
  const [notes, setNotes] = useState<Note[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState<HealthCheckStatus[]>([])

  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [noteTitle, setNoteTitle] = useState("")
  const [noteContent, setNoteContent] = useState("")
  const [noteCategory, setNoteCategory] = useState("general")

  const editorRef = useRef<RichTextEditorRef | null>(null)

  useEffect(() => {
    loadData()

    checkAllAIServices().then(setAiStatus)

    initializeDefaultPersonas().catch((error) => {
      logger.error("Failed to initialize default personas:", error)
    })

    chrome.runtime.sendMessage({ type: "SIDE_PANEL_OPENED" })

    const handleMessage = (
      message: any,
      sender: chrome.runtime.MessageSender
    ) => {
      if (message.type === "CLOSE_SIDE_PANEL") {
        window.close()
      } else if (message.type === "FILL_EDITOR") {
        const content = message.data.content || ""
        const isHtml = message.data.isHtml || false

        setNoteTitle("")
        setNoteCategory("general")
        setEditingNote(null)
        setView("editor")

        if (isHtml) {
          setNoteContent(content)

          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.setContent(content)
            }
          }, 100)
        } else {
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
      logger.error("Error loading data:", error)
    }
    setLoading(false)
  }

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

    if (!contentPlaintext.trim()) {
      alert("Content is required")
      return
    }

    const categoryToSave = finalCategory || noteCategory

    setLoading(true)
    try {
      let finalTitle = noteTitle.trim()
      if (!finalTitle) {
        logger.log(
          " [Auto Title] No title provided, generating automatically..."
        )
        const titleGenerationStart = performance.now()

        try {
          finalTitle = await generateTitle("", contentPlaintext)
          logger.log(
            ` [Auto Title] Generated: "${finalTitle}" in ${(performance.now() - titleGenerationStart).toFixed(2)}ms`
          )

          setNoteTitle(finalTitle)
        } catch (error) {
          logger.error(" [Auto Title] Generation failed:", error)

          finalTitle = "Untitled Note"
          setNoteTitle(finalTitle)
        }
      }

      const contentJSONString = JSON.stringify(contentJSON)

      if (editingNote) {
        const updateStartTime = performance.now()
        logger.log(" [UI Update] Updating existing note:", editingNote.id)

        const embeddingStartTime = performance.now()
        const embedding = await generateEmbedding(contentPlaintext)
        const embeddingTime = performance.now() - embeddingStartTime
        logger.log(
          ` [UI Update] Embedding generation: ${embeddingTime.toFixed(2)}ms (${embedding.length} dimensions)`
        )

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
        logger.log(
          ` [UI Update] Background processing (encrypt + DB): ${messageTime.toFixed(2)}ms`
        )

        if (!response.success) {
          throw new Error(response.error || "Update failed")
        }

        const totalTime = performance.now() - updateStartTime
        logger.log(` [UI Update] TOTAL update time: ${totalTime.toFixed(2)}ms`)
        logger.log(
          ` [UI Update] Breakdown: Embedding=${embeddingTime.toFixed(2)}ms, Background=${messageTime.toFixed(2)}ms`
        )
      } else {
        const saveStartTime = performance.now()
        logger.log(" [UI Save] Creating new note...")

        const embeddingStartTime = performance.now()
        const embedding = await generateEmbedding(contentPlaintext)
        const embeddingTime = performance.now() - embeddingStartTime
        logger.log(
          ` [UI Save] Embedding generation: ${embeddingTime.toFixed(2)}ms (${embedding.length} dimensions)`
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

        const messageStartTime = performance.now()
        const saveId = `save_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        logger.log(
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
        logger.log(
          ` [UI Save] Background processing (encrypt + DB): ${messageTime.toFixed(2)}ms`
        )

        if (!response.success) {
          throw new Error(response.error || "Save failed")
        }

        const totalTime = performance.now() - saveStartTime
        logger.log(` [UI Save] TOTAL save time: ${totalTime.toFixed(2)}ms`)
        logger.log(
          ` [UI Save] Breakdown: Embedding=${embeddingTime.toFixed(2)}ms, Background=${messageTime.toFixed(2)}ms`
        )
      }

      logger.log("Reloading data...")
      await loadData()
      clearSearchQuery()
      logger.log("Switching to list view")
      setView("list")
    } catch (error) {
      logger.error(" Error saving note:", error)
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
      logger.error("Error deleting note:", error)
      alert("Failed to delete note")
    }
    setLoading(false)
  }

  const handleClose = () => {
    window.close()
  }

  const handlePersonasClick = () => {
    logger.log(" [SidePanel] Switching to personas view")
    setView("personas")
  }

  const handlePersonaActivated = async (persona: Persona | null) => {
    logger.log(" [SidePanel] Persona activated:", persona?.name || "None")

    try {
      const agent = await getGlobalAgent()
      await agent.setPersona(persona)

      logger.log(" [SidePanel] Global agent updated with persona")
    } catch (error) {
      logger.error(" [SidePanel] Error updating agent persona:", error)
    }
  }

  const handleBackToList = () => {
    logger.log(" [SidePanel] Switching back to list view")
    setView("list")
  }

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      setLoading(true)
      try {
        const results = await searchNotesByTitle(searchQuery)
        setNotes(results)
      } catch (error) {
        logger.error("Error searching:", error)
      }
      setLoading(false)
    } else {
      loadData()
    }
  }

  const handleSearchInput = (value: string) => {
    logger.log(" [Search] Query changed to:", value)
    setSearchQuery(value)
  }

  const handleAISearch = async (
    query: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    onStreamChunk?: (chunk: string) => void
  ): Promise<string | import("~services/langchain-agent").AgentResponse> => {
    const startTime = performance.now()

    try {
      logger.log(" [LangChain Agent] Processing query:", query)

      const agent = await getGlobalAgent()

      if (onStreamChunk) {
        logger.log(" [LangChain Agent] Using streaming mode")

        let finalResponse:
          | import("~services/langchain-agent").AgentResponse
          | null = null

        for await (const event of agent.runStream(query, conversationHistory)) {
          if (event.type === "chunk") {
            onStreamChunk(event.data as string)
          } else if (event.type === "complete") {
            finalResponse =
              event.data as import("~services/langchain-agent").AgentResponse
          }
        }

        const totalTime = performance.now() - startTime
        logger.log(
          ` [LangChain Agent] TOTAL stream time: ${totalTime.toFixed(2)}ms`
        )
        logger.log(` [LangChain Agent] Final response:`, finalResponse)

        return (
          finalResponse || {
            aiResponse: "",
            extractedData: null,
            referenceNotes: []
          }
        )
      }

      const response = await agent.run(query, conversationHistory)

      const totalTime = performance.now() - startTime
      logger.log(` [LangChain Agent] TOTAL time: ${totalTime.toFixed(2)}ms`)
      logger.log(` [LangChain Agent] Structured response:`, response)

      return response
    } catch (error) {
      const totalTime = performance.now() - startTime
      logger.error(
        ` [LangChain Agent] Failed after ${totalTime.toFixed(2)}ms:`,
        error
      )
      return "I encountered an error while searching. Please try again."
    }
  }

  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      searchQuery === "" ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.contentPlaintext.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  if (searchQuery) {
    logger.log(
      ` [Search] Query: "${searchQuery}", Total notes: ${notes.length}, Filtered: ${filteredNotes.length}`
    )
  }

  return (
    <div className="plasmo-w-full plasmo-h-screen plasmo-bg-slate-50 plasmo-overflow-hidden">
      <div className="plasmo-h-full plasmo-flex plasmo-flex-col">
        {}
        <Header
          onClose={handleClose}
          onPersonasClick={handlePersonasClick}
          onCreateNote={handleCreateNew}
          view={view}
          searchValue={searchQuery}
          onSearchChange={handleSearchInput}
          onSearchClear={clearSearchQuery}
        />

        {}
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
              {}
              <div className="plasmo-flex-shrink-0">
                {}
                <AIStatusBanner />
              </div>

              {}
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

          {}
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
