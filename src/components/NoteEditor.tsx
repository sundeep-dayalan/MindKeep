import { useEffect, useRef, useState } from "react"

import CategorySuggestions from "~components/CategorySuggestions"
import {
  RichTextEditor,
  type RichTextEditorRef
} from "~components/RichTextEditor"
import { generateTitle, summarizeText } from "~services/ai-service"
import { markdownToTipTapHTML } from "~util/markdown-to-tiptap"

import { HoverBorderGradient } from "./ui/hover-border-gradient"

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
  externalEditorRef?: React.MutableRefObject<RichTextEditorRef | null>
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
  onCancel,
  externalEditorRef
}: NoteEditorProps) {
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [hasEditorContent, setHasEditorContent] = useState(false)
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [currentContent, setCurrentContent] = useState(content) // Track content for suggestions

  const internalEditorRef = useRef<RichTextEditorRef>(null)
  const editorRef = externalEditorRef || internalEditorRef

  // Update content when it changes from outside
  useEffect(() => {
    if (content && editorRef.current) {
      editorRef.current.setContent(content)
    }
  }, [content])

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
      // Get markdown summary from AI
      const markdownSummary = await summarizeText(contentPlaintext)

      // Convert markdown to HTML for TipTap
      const richHTML = await markdownToTipTapHTML(markdownSummary)

      // Set the rich HTML content in the editor
      editorRef.current?.setContent(richHTML)

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
    <div className="plasmo-space-y-5">
      {/* Header */}
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-mb-6">
        <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
          <button
            onClick={onCancel}
            className="plasmo-p-1.5 plasmo-text-slate-600 hover:plasmo-bg-slate-100 plasmo-rounded-lg plasmo-transition-colors">
            <svg
              className="plasmo-w-5 plasmo-h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h2 className="plasmo-text-lg plasmo-font-semibold plasmo-text-slate-900">
            {isEditing ? "Edit Note" : "New Note"}
          </h2>
        </div>
        <button
          onClick={onCancel}
          className="plasmo-p-1.5 plasmo-text-slate-400 hover:plasmo-text-slate-600 plasmo-transition-colors">
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

      {/* Form Content */}
      <div className="plasmo-space-y-5">
        {/* Title Field */}
        <div>
          <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-slate-900 plasmo-mb-2">
            Note title
          </label>
          <div className="plasmo-relative">
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Enter note title"
              className="plasmo-w-full plasmo-px-4 plasmo-py-2.5 plasmo-pr-12 plasmo-border plasmo-border-slate-200 plasmo-rounded-lg focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-transparent plasmo-transition-all plasmo-text-slate-900 placeholder:plasmo-text-slate-400"
            />
            <button
              onClick={handleGenerateTitle}
              disabled={isGeneratingTitle || !hasEditorContent}
              className="plasmo-absolute plasmo-right-3 plasmo-top-1/2 plasmo--translate-y-1/2 plasmo-p-2 plasmo-text-purple-600 hover:plasmo-bg-purple-50 plasmo-rounded-lg disabled:plasmo-opacity-40 disabled:plasmo-cursor-not-allowed plasmo-transition-all"
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

        {/* Content Editor */}
        <div>
          <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-slate-900 plasmo-mb-2">
            Content
          </label>
          <div className="plasmo-border plasmo-border-slate-200 plasmo-rounded-lg plasmo-overflow-hidden focus-within:plasmo-ring-2 focus-within:plasmo-ring-blue-500 focus-within:plasmo-border-transparent plasmo-transition-all">
            <RichTextEditor
              ref={editorRef}
              initialContent={content}
              placeholder="Start typing your note..."
              onUpdate={(plainText) => {
                setHasEditorContent(plainText.trim().length > 0)
                setCurrentContent(plainText)
              }}
              onSummarize={handleSummarizeContent}
              isSummarizing={isSummarizing}
            />
          </div>
        </div>

        {/* Category Section */}
        {showNewCategory ? (
          <div>
            <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-slate-900 plasmo-mb-2">
              New Category
            </label>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Enter new category name"
              className="plasmo-w-full plasmo-px-4 plasmo-py-2.5 plasmo-border plasmo-border-slate-200 plasmo-rounded-lg focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-transparent plasmo-transition-all plasmo-text-slate-900 placeholder:plasmo-text-slate-400"
            />
            <button
              onClick={() => {
                setShowNewCategory(false)
                setNewCategoryName("")
              }}
              className="plasmo-mt-2 plasmo-text-sm plasmo-text-blue-600 hover:plasmo-text-blue-700 plasmo-font-medium plasmo-transition-colors">
              ← Use existing category
            </button>
          </div>
        ) : (
          <div className="plasmo-space-y-4">
            <div>
              <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-slate-900 plasmo-mb-2">
                Category
              </label>
              <div className="plasmo-relative">
                <select
                  value={category}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  className="plasmo-w-full plasmo-px-4 plasmo-py-2.5 plasmo-pr-10 plasmo-border plasmo-border-slate-200 plasmo-rounded-lg focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-transparent plasmo-transition-all plasmo-text-slate-900 plasmo-appearance-none plasmo-bg-white plasmo-cursor-pointer">
                  {categories.length === 0 && (
                    <option value="general">general</option>
                  )}
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <div className="plasmo-absolute plasmo-right-4 plasmo-top-1/2 plasmo--translate-y-1/2 plasmo-pointer-events-none">
                  <svg
                    className="plasmo-w-5 plasmo-h-5 plasmo-text-slate-400"
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
                </div>
              </div>
              <button
                onClick={() => setShowNewCategory(true)}
                className="plasmo-mt-2 plasmo-text-sm plasmo-text-blue-600 hover:plasmo-text-blue-700 plasmo-font-medium plasmo-transition-colors">
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
            />
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="plasmo-flex plasmo-items-center plasmo-justify-end plasmo-gap-3 plasmo-pt-6 plasmo-border-t plasmo-border-slate-200">
        <button
          onClick={onCancel}
          disabled={loading}
          className="plasmo-px-5 plasmo-py-2 plasmo-border plasmo-border-slate-300 plasmo-text-slate-700 plasmo-rounded-lg plasmo-font-medium hover:plasmo-bg-slate-50 plasmo-transition-all disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed">
          Cancel
        </button>
        <HoverBorderGradient
          onClick={handleSave}
          disabled={loading}
          containerClassName="rounded-full"
          as="button"
          className="plasmo-dark:bg-black plasmo-bg-blue-300  plasmo-text-white plasmo-dark:text-white flex plasmo-items-center plasmo-space-x-2">
          {loading ? (
            <span className="plasmo-flex plasmo-items-center plasmo-gap-2">
              <svg
                className="plasmo-w-4 plasmo-h-4 plasmo-animate-spin"
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
              Saving...
            </span>
          ) : (
            <span>{isEditing ? "Update Note" : "Create Note"}</span>
          )}
        </HoverBorderGradient>
        {/* <button
          onClick={handleSave}
          disabled={loading}
          className="plasmo-px-5 plasmo-py-2 plasmo-bg-blue-600 plasmo-text-white plasmo-rounded-lg plasmo-font-medium hover:plasmo-bg-blue-700 plasmo-transition-all disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed">
        
        </button> */}
      </div>
    </div>
  )
}

export type { RichTextEditorRef }
