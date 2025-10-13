import { useEffect, useState } from "react"

import "~style.css"

import { AIStatusBanner } from "~components/AIStatusBanner"
import {
  generateEmbedding,
  generateTitle,
  summarizeText
} from "~services/ai-service"
import {
  deleteNote,
  getAllCategories,
  getAllNotes,
  searchNotesByTitle,
  type Note
} from "~services/db-service"

type View = "list" | "editor"

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
  const [newCategoryName, setNewCategoryName] = useState("")
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)

  // Load notes and categories
  useEffect(() => {
    loadData()
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

  const handleCreateNew = () => {
    setEditingNote(null)
    setNoteTitle("")
    setNoteContent("")
    setNoteCategory("general")
    setShowNewCategory(false)
    setView("editor")
  }

  const handleEditNote = (note: Note) => {
    setEditingNote(note)
    setNoteTitle(note.title)
    setNoteContent(note.content)
    setNoteCategory(note.category)
    setShowNewCategory(false)
    setView("editor")
  }

  const handleSaveNote = async () => {
    if (!noteTitle.trim() || !noteContent?.trim()) {
      alert("Title and content are required")
      return
    }

    setLoading(true)
    try {
      const finalCategory = showNewCategory
        ? newCategoryName.trim().toLowerCase()
        : noteCategory

      if (!finalCategory) {
        alert("Category is required")
        setLoading(false)
        return
      }

      if (editingNote) {
        // For updates, generate embedding here (in DOM context with full Web APIs)
        console.log("✏️ Updating existing note:", editingNote.id)

        // Generate new embedding for updated content
        console.log("🔢 Generating embedding from updated content...")
        const embedding = await generateEmbedding(noteContent)
        console.log(`✅ Embedding generated: ${embedding.length} dimensions`)

        // Send update request to background script with pre-generated embedding
        const response = await chrome.runtime.sendMessage({
          type: "UPDATE_NOTE",
          data: {
            id: editingNote.id,
            title: noteTitle,
            content: noteContent,
            category: finalCategory,
            embedding // Pass the pre-generated embedding
          }
        })

        if (!response.success) {
          throw new Error(response.error || "Update failed")
        }
        console.log("✅ Update result:", response.note)
      } else {
        // For new notes, generate embedding here (in DOM context with full Web APIs)
        console.log("📝 Creating new note...")

        // Step 1: Generate embedding from plaintext content (HERE in side panel)
        console.log("🔢 Generating embedding from plaintext content...")
        const embedding = await generateEmbedding(noteContent)
        console.log(`✅ Embedding generated: ${embedding.length} dimensions`)

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
        const response = await chrome.runtime.sendMessage({
          type: "SAVE_NOTE",
          data: {
            title: noteTitle,
            content: noteContent, // Send PLAINTEXT - background will encrypt
            category: finalCategory,
            sourceUrl,
            embedding // Pass the pre-generated embedding
          }
        })

        if (!response.success) {
          throw new Error(response.error || "Save failed")
        }

        console.log("✅ Note saved successfully:", response.note)
      }

      console.log("Reloading data...")
      await loadData()
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

  const handleGenerateTitle = async () => {
    if (!noteContent?.trim()) {
      alert("Please enter some content first")
      return
    }

    setIsGeneratingTitle(true)
    try {
      const generatedTitle = await generateTitle(noteTitle, noteContent)
      setNoteTitle(generatedTitle)
    } catch (error) {
      console.error("Error generating title:", error)
      // Show detailed error message
      const errorMessage = error.message || "Failed to generate title"
      if (
        confirm(
          errorMessage +
            "\n\nWould you like to open Chrome flags to enable AI features?"
        )
      ) {
        chrome.tabs.create({
          url: "chrome://flags/#optimization-guide-on-device-model"
        })
      }
    }
    setIsGeneratingTitle(false)
  }

  const handleSummarizeContent = async () => {
    if (!noteContent?.trim()) {
      alert("Please enter some content first")
      return
    }

    setIsSummarizing(true)
    try {
      const summary = await summarizeText(noteContent)
      setNoteContent(summary)
    } catch (error) {
      console.error("Error summarizing content:", error)
      alert("Failed to summarize content")
    }
    setIsSummarizing(false)
  }

  return (
    <div className="plasmo-w-full plasmo-h-screen plasmo-bg-slate-50 plasmo-overflow-hidden">
      <div className="plasmo-h-full plasmo-flex plasmo-flex-col">
        {/* Header */}
        <div className="plasmo-bg-white plasmo-border-b plasmo-border-slate-200 plasmo-p-4">
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
            <h1 className="plasmo-text-xl plasmo-font-bold plasmo-text-slate-900">
              MindKeep 🧠
            </h1>
            <button
              onClick={handleClose}
              className="plasmo-p-2 plasmo-rounded-lg plasmo-text-slate-500 hover:plasmo-text-slate-900 hover:plasmo-bg-slate-100 plasmo-transition-colors"
              title="Close">
              <svg
                className="plasmo-w-5 plasmo-h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="plasmo-flex-1 plasmo-overflow-y-auto plasmo-p-4">
          {/* AI Status Banner */}
          <AIStatusBanner />

          {view === "list" ? (
            <>
              {/* Search and Filters */}
              <div className="plasmo-mb-4 plasmo-space-y-3">
                <div className="plasmo-flex plasmo-gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search with keywords..."
                    className="plasmo-flex-1 plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-slate-300 plasmo-rounded-lg plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500"
                  />
                  <button
                    onClick={handleSearch}
                    className="plasmo-px-4 plasmo-py-2 plasmo-bg-blue-500 plasmo-text-white plasmo-rounded-lg plasmo-text-sm hover:plasmo-bg-blue-600 plasmo-transition-colors">
                    Search
                  </button>
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-slate-300 plasmo-rounded-lg plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500">
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleCreateNew}
                  disabled={loading}
                  className="plasmo-w-full plasmo-px-4 plasmo-py-2 plasmo-bg-green-500 plasmo-text-white plasmo-rounded-lg plasmo-text-sm plasmo-font-medium hover:plasmo-bg-green-600 plasmo-transition-colors disabled:plasmo-opacity-50">
                  + Create New Note
                </button>
              </div>

              {/* Notes List */}
              {loading ? (
                <div className="plasmo-text-center plasmo-py-8 plasmo-text-slate-500">
                  Loading...
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className="plasmo-text-center plasmo-py-8 plasmo-text-slate-500">
                  No notes found. Create your first note!
                </div>
              ) : (
                <div className="plasmo-space-y-2">
                  {filteredNotes.map((note) => (
                    <div
                      key={note.id}
                      className="plasmo-bg-white plasmo-p-3 plasmo-rounded-lg plasmo-border plasmo-border-slate-200 hover:plasmo-border-blue-300 plasmo-transition-colors">
                      <div className="plasmo-flex plasmo-items-start plasmo-justify-between plasmo-gap-2">
                        <div className="plasmo-flex-1 plasmo-min-w-0">
                          <h3 className="plasmo-font-medium plasmo-text-slate-900 plasmo-truncate">
                            {note.title}
                          </h3>
                          <p className="plasmo-text-sm plasmo-text-slate-600 plasmo-mt-1 plasmo-line-clamp-2">
                            {note.content}
                          </p>
                          <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-mt-2">
                            <span className="plasmo-text-xs plasmo-px-2 plasmo-py-1 plasmo-bg-blue-100 plasmo-text-blue-700 plasmo-rounded">
                              {note.category}
                            </span>
                            <span className="plasmo-text-xs plasmo-text-slate-400">
                              {new Date(note.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="plasmo-flex plasmo-gap-1">
                          <button
                            onClick={() => handleEditNote(note)}
                            className="plasmo-p-1 plasmo-text-blue-600 hover:plasmo-bg-blue-50 plasmo-rounded"
                            title="Edit">
                            <svg
                              className="plasmo-w-4 plasmo-h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="plasmo-p-1 plasmo-text-red-600 hover:plasmo-bg-red-50 plasmo-rounded"
                            title="Delete">
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
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Editor View */
            <div className="plasmo-space-y-4">
              <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-mb-4">
                <button
                  onClick={() => setView("list")}
                  className="plasmo-p-2 plasmo-text-slate-600 hover:plasmo-bg-slate-200 plasmo-rounded-lg">
                  <svg
                    className="plasmo-w-5 plasmo-h-5"
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
                </button>
                <h2 className="plasmo-text-lg plasmo-font-semibold">
                  {editingNote ? "Edit Note" : "New Note"}
                </h2>
              </div>

              <div className="plasmo-space-y-2">
                <label className="plasmo-text-sm plasmo-font-medium plasmo-text-slate-700">
                  Title
                </label>
                <div className="plasmo-relative">
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Note title"
                    className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-pr-10 plasmo-border plasmo-border-slate-300 plasmo-rounded-lg focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500"
                  />
                  <button
                    onClick={handleGenerateTitle}
                    disabled={isGeneratingTitle || !noteContent?.trim()}
                    className="plasmo-absolute plasmo-right-2 plasmo-top-1/2 plasmo--translate-y-1/2 plasmo-p-1.5 plasmo-text-purple-600 hover:plasmo-bg-purple-50 plasmo-rounded disabled:plasmo-opacity-40 disabled:plasmo-cursor-not-allowed plasmo-transition-colors"
                    title="Generate title from content using AI">
                    {isGeneratingTitle ? (
                      <svg
                        className="plasmo-w-5 plasmo-h-5 plasmo-animate-spin"
                        fill="none"
                        viewBox="0 0 24 24">
                        <circle
                          className="plasmo-opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="plasmo-opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="plasmo-w-5 plasmo-h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="plasmo-space-y-2">
                <label className="plasmo-text-sm plasmo-font-medium plasmo-text-slate-700">
                  Content
                </label>
                <div className="plasmo-relative">
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Note content"
                    rows={10}
                    className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-pr-10 plasmo-border plasmo-border-slate-300 plasmo-rounded-lg plasmo-resize-none focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500"
                  />
                  <button
                    onClick={handleSummarizeContent}
                    disabled={isSummarizing || !noteContent?.trim()}
                    className="plasmo-absolute plasmo-right-2 plasmo-top-2 plasmo-p-1.5 plasmo-text-purple-600 hover:plasmo-bg-purple-50 plasmo-rounded disabled:plasmo-opacity-40 disabled:plasmo-cursor-not-allowed plasmo-transition-colors"
                    title="Summarize content using AI">
                    {isSummarizing ? (
                      <svg
                        className="plasmo-w-5 plasmo-h-5 plasmo-animate-spin"
                        fill="none"
                        viewBox="0 0 24 24">
                        <circle
                          className="plasmo-opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="plasmo-opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="plasmo-w-5 plasmo-h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {showNewCategory ? (
                <div className="plasmo-space-y-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category name"
                    className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-slate-300 plasmo-rounded-lg focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500"
                  />
                  <button
                    onClick={() => {
                      setShowNewCategory(false)
                      setNewCategoryName("")
                    }}
                    className="plasmo-text-sm plasmo-text-blue-600 hover:plasmo-underline">
                    Use existing category
                  </button>
                </div>
              ) : (
                <div className="plasmo-space-y-2">
                  <select
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value)}
                    className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-slate-300 plasmo-rounded-lg focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500">
                    {categories.length === 0 && (
                      <option value="general">general</option>
                    )}
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowNewCategory(true)}
                    className="plasmo-text-sm plasmo-text-blue-600 hover:plasmo-underline">
                    + Create new category
                  </button>
                </div>
              )}

              <div className="plasmo-flex plasmo-gap-2">
                <button
                  onClick={handleSaveNote}
                  disabled={loading}
                  className="plasmo-flex-1 plasmo-px-4 plasmo-py-2 plasmo-bg-blue-500 plasmo-text-white plasmo-rounded-lg plasmo-font-medium hover:plasmo-bg-blue-600 plasmo-transition-colors disabled:plasmo-opacity-50">
                  {loading ? "Saving..." : "Save Note"}
                </button>
                <button
                  onClick={() => setView("list")}
                  disabled={loading}
                  className="plasmo-px-4 plasmo-py-2 plasmo-border plasmo-border-slate-300 plasmo-text-slate-700 plasmo-rounded-lg plasmo-font-medium hover:plasmo-bg-slate-100 plasmo-transition-colors disabled:plasmo-opacity-50">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SidePanel
