import { useRef, useState } from "react"

import CategorySuggestions from "~components/CategorySuggestions"
import {
  RichTextEditor,
  type RichTextEditorRef
} from "~components/RichTextEditor"
import { generateTitle, summarizeText } from "~services/ai-service"

interface NoteEditorProps {
  title: string
  content: string
  category: string
  categories: string[]
  isEditing: boolean
  loading: boolean
  onTitleChange: (title: string) => void
  onCategoryChange: (category: string) => void
  onSave: (editorRef: RichTextEditorRef | null, finalCategory?: string) => void
  onCancel: () => void
}

export function NoteEditor({
  title,
  content,
  category,
  categories,
  isEditing,
  loading,
  onTitleChange,
  onCategoryChange,
  onSave,
  onCancel
}: NoteEditorProps) {
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [hasEditorContent, setHasEditorContent] = useState(false)
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [currentContent, setCurrentContent] = useState(content) // Track content for suggestions

  const editorRef = useRef<RichTextEditorRef>(null)

  const handleGenerateTitle = async () => {
    const contentPlaintext = editorRef.current?.getText() || ""
    if (!contentPlaintext.trim()) {
      alert("Please enter some content first")
      return
    }

    const startTime = performance.now()
    console.log("🎯 [UI] Starting title generation...")

    setIsGeneratingTitle(true)
    try {
      const generatedTitle = await generateTitle(title, contentPlaintext)
      onTitleChange(generatedTitle)

      const totalTime = performance.now() - startTime
      console.log(
        `⏱️ [UI] Title generation completed: ${totalTime.toFixed(2)}ms`
      )
    } catch (error) {
      const totalTime = performance.now() - startTime
      console.error(
        `❌ [UI] Title generation failed after ${totalTime.toFixed(2)}ms:`,
        error
      )
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
    const contentPlaintext = editorRef.current?.getText() || ""
    if (!contentPlaintext.trim()) {
      alert("Please enter some content first")
      return
    }

    const startTime = performance.now()
    console.log("📝 [UI] Starting content summarization...")

    setIsSummarizing(true)
    try {
      const summary = await summarizeText(contentPlaintext)
      editorRef.current?.setContent(summary)

      const totalTime = performance.now() - startTime
      console.log(
        `⏱️ [UI] Content summarization completed: ${totalTime.toFixed(2)}ms`
      )
    } catch (error) {
      const totalTime = performance.now() - startTime
      console.error(
        `❌ [UI] Content summarization failed after ${totalTime.toFixed(2)}ms:`,
        error
      )
      alert("Failed to summarize content")
    }
    setIsSummarizing(false)
  }

  const handleCategoryChange = (value: string) => {
    if (showNewCategory) {
      setNewCategoryName(value)
    } else {
      onCategoryChange(value)
    }
  }

  const handleSave = () => {
    let finalCategory = category

    if (showNewCategory) {
      finalCategory = newCategoryName.trim().toLowerCase()
      if (!finalCategory) {
        alert("Category is required")
        return
      }

      // Check for duplicate category
      const existingCategories = categories.map((cat) => cat.toLowerCase())
      if (existingCategories.includes(finalCategory)) {
        alert(
          `Category "${finalCategory}" already exists. Please select it from the dropdown or choose a different name.`
        )
        return
      }

      // Update parent component's category state for UI consistency
      onCategoryChange(finalCategory)
    }

    // Pass the final category to the save handler
    onSave(editorRef.current, finalCategory)
  }

  return (
    <div className="plasmo-space-y-4">
      <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-mb-4">
        <button
          onClick={onCancel}
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
          {isEditing ? "Edit Note" : "New Note"}
        </h2>
      </div>

      <div className="plasmo-space-y-2">
        <label className="plasmo-text-sm plasmo-font-medium plasmo-text-slate-700">
          Title
        </label>
        <div className="plasmo-relative">
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Note title"
            className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-pr-10 plasmo-border plasmo-border-slate-300 plasmo-rounded-lg focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500"
          />
          <button
            onClick={handleGenerateTitle}
            disabled={isGeneratingTitle || !hasEditorContent}
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
        <RichTextEditor
          ref={editorRef}
          initialContent={content}
          placeholder="Start typing your note..."
          onUpdate={(plainText) => {
            setHasEditorContent(plainText.trim().length > 0)
            setCurrentContent(plainText) // Update content state for suggestions
          }}
          onSummarize={handleSummarizeContent}
          isSummarizing={isSummarizing}
        />
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
        <div className="plasmo-space-y-3">
          <div className="plasmo-space-y-2">
            <label className="plasmo-text-sm plasmo-font-medium plasmo-text-slate-700">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
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

          {/* AI-Powered Category Suggestions */}
          <CategorySuggestions
            noteTitle={title}
            noteContent={currentContent}
            availableCategories={categories.filter((cat) => cat !== category)}
            onCategorySelect={(selectedCategory) => {
              onCategoryChange(selectedCategory)
            }}
            excludeCategories={[category]}
            minRelevanceScore={0}
            maxSuggestions={3}
            className="plasmo-mt-3"
          />
        </div>
      )}

      <div className="plasmo-flex plasmo-gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="plasmo-flex-1 plasmo-px-4 plasmo-py-2 plasmo-bg-blue-500 plasmo-text-white plasmo-rounded-lg plasmo-font-medium hover:plasmo-bg-blue-600 plasmo-transition-colors disabled:plasmo-opacity-50">
          {loading ? "Saving..." : "Save Note"}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="plasmo-px-4 plasmo-py-2 plasmo-border plasmo-border-slate-300 plasmo-text-slate-700 plasmo-rounded-lg plasmo-font-medium hover:plasmo-bg-slate-100 plasmo-transition-colors disabled:plasmo-opacity-50">
          Cancel
        </button>
      </div>
    </div>
  )
}

export type { RichTextEditorRef }
