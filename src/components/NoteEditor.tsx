import { useEffect, useRef, useState } from "react"

import CategorySuggestions from "~components/CategorySuggestions"
import {
  RichTextEditor,
  type RichTextEditorRef
} from "~components/RichTextEditor"
import { generateTitle, summarizeText } from "~services/ai-service"
import { markdownToTipTapHTML } from "~util/markdown-to-tiptap"

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
  const [currentContent, setCurrentContent] = useState(content)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [isToolbarVisible, setIsToolbarVisible] = useState(false)

  const internalEditorRef = useRef<RichTextEditorRef>(null)
  const editorRef = externalEditorRef || internalEditorRef

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
    console.log(" [UI] Starting title generation...")

    setIsGeneratingTitle(true)
    try {
      const generatedTitle = await generateTitle(title, contentPlaintext)
      onTitleChange(generatedTitle)

      const totalTime = performance.now() - startTime
      console.log(
        `⏱ [UI] Title generation completed: ${totalTime.toFixed(2)}ms`
      )
    } catch (error) {
      const totalTime = performance.now() - startTime
      console.error(
        ` [UI] Title generation failed after ${totalTime.toFixed(2)}ms:`,
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
    console.log(" [UI] Starting content summarization...")

    setIsSummarizing(true)
    try {
      const markdownSummary = await summarizeText(contentPlaintext)

      const richHTML = await markdownToTipTapHTML(markdownSummary)

      editorRef.current?.setContent(richHTML)

      const totalTime = performance.now() - startTime
      console.log(
        `⏱ [UI] Content summarization completed: ${totalTime.toFixed(2)}ms`
      )
    } catch (error) {
      const totalTime = performance.now() - startTime
      console.error(
        ` [UI] Content summarization failed after ${totalTime.toFixed(2)}ms:`,
        error
      )
      alert("Failed to summarize content")
    }
    setIsSummarizing(false)
  }

  const handleAddCategory = () => {
    const finalCategory = newCategoryName.trim().toLowerCase()
    if (!finalCategory) {
      alert("Category name is required")
      return
    }

    const existingCategories = categories.map((cat) => cat.toLowerCase())
    if (existingCategories.includes(finalCategory)) {
      alert(
        `Category "${finalCategory}" already exists. Please select it from the dropdown.`
      )
      return
    }

    onCategoryChange(finalCategory)
    setShowNewCategory(false)
    setNewCategoryName("")
  }

  const handleSave = () => {
    let finalCategory = category

    if (showNewCategory) {
      finalCategory = newCategoryName.trim().toLowerCase()
      if (!finalCategory) {
        alert("Category is required")
        return
      }

      const existingCategories = categories.map((cat) => cat.toLowerCase())
      if (existingCategories.includes(finalCategory)) {
        alert(
          `Category "${finalCategory}" already exists. Please select it from the dropdown or choose a different name.`
        )
        return
      }

      onCategoryChange(finalCategory)
    }

    onSave(editorRef.current, finalCategory)
  }

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-h-full plasmo-relative">
      {}
      <div className="plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-border-b plasmo-border-slate-200 plasmo-pb-3">
        <button
          onClick={onCancel}
          className="plasmo-p-1.5 plasmo-text-slate-600 hover:plasmo-bg-slate-100 plasmo-rounded-lg plasmo-transition-colors plasmo-flex-shrink-0">
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
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled Note"
          className="plasmo-flex-1 plasmo-text-lg plasmo-font-normal plasmo-text-slate-900 plasmo-bg-transparent plasmo-border-none focus:plasmo-outline-none placeholder:plasmo-text-slate-400"
        />
        <button
          onClick={handleGenerateTitle}
          disabled={isGeneratingTitle || !hasEditorContent}
          className="plasmo-p-2 plasmo-text-purple-600 hover:plasmo-bg-purple-50 plasmo-rounded-lg disabled:plasmo-opacity-40 disabled:plasmo-cursor-not-allowed plasmo-transition-all plasmo-flex-shrink-0"
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

      {}
      <div className="plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-px-3 plasmo-py-3 plasmo-border-b plasmo-border-slate-200">
        {}
        <div className="plasmo-flex-shrink-0 plasmo-relative plasmo-z-10">
          {showNewCategory ? (
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Enter category name"
              className="plasmo-w-40 plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-slate-200 plasmo-rounded-lg focus:plasmo-outline-none focus:plasmo-ring-2 plasmo-ring-blue-500 plasmo-text-sm plasmo-text-slate-900 placeholder:plasmo-text-slate-400"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddCategory()
                } else if (e.key === "Escape") {
                  setShowNewCategory(false)
                  setNewCategoryName("")
                }
              }}
              autoFocus
            />
          ) : (
            <div className="plasmo-relative plasmo-w-40">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-pr-8 plasmo-border plasmo-border-slate-200 plasmo-rounded-lg focus:plasmo-outline-none focus:plasmo-ring-2 plasmo-ring-blue-500 plasmo-text-sm plasmo-text-slate-900 plasmo-bg-white plasmo-cursor-pointer plasmo-text-left hover:plasmo-bg-slate-50 plasmo-transition-colors plasmo-truncate plasmo-whitespace-nowrap plasmo-overflow-hidden">
                {category || "general"}
              </button>
              <div className="plasmo-absolute plasmo-right-2 plasmo-top-1/2 plasmo--translate-y-1/2 plasmo-pointer-events-none">
                <svg
                  className={`plasmo-w-4 plasmo-h-4 plasmo-text-slate-400 plasmo-transition-transform ${showCategoryDropdown ? "plasmo-rotate-180" : ""}`}
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

              {}
              {showCategoryDropdown && (
                <>
                  {}
                  <div
                    className="plasmo-fixed plasmo-inset-0 plasmo-z-10"
                    onClick={() => setShowCategoryDropdown(false)}
                  />
                  {}
                  <div className="plasmo-absolute plasmo-top-full plasmo-left-0 plasmo-w-64 plasmo-mt-1 plasmo-bg-white plasmo-border plasmo-border-slate-200 plasmo-rounded-lg plasmo-shadow-xl plasmo-z-20 plasmo-max-h-80 plasmo-overflow-y-auto plasmo-no-visible-scrollbar plasmo-py-1">
                    {categories.length === 0 ? (
                      <button
                        onClick={() => {
                          onCategoryChange("general")
                          setShowCategoryDropdown(false)
                        }}
                        className="plasmo-w-full plasmo-px-4 plasmo-py-2.5 plasmo-text-left plasmo-text-sm plasmo-text-slate-900 hover:plasmo-bg-slate-50 plasmo-transition-colors">
                        general
                      </button>
                    ) : (
                      categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => {
                            onCategoryChange(cat)
                            setShowCategoryDropdown(false)
                          }}
                          className={`plasmo-w-full plasmo-px-4 plasmo-py-2.5 plasmo-text-left plasmo-text-sm plasmo-transition-colors ${
                            category === cat
                              ? "plasmo-bg-blue-50 plasmo-text-blue-700 plasmo-font-medium"
                              : "plasmo-text-slate-900 hover:plasmo-bg-slate-50"
                          }`}>
                          {cat}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {}
        <div className="plasmo-flex-shrink-0 plasmo-relative plasmo-z-10">
          {showNewCategory ? (
            <button
              onClick={handleAddCategory}
              className="plasmo-p-2 plasmo-text-green-600 hover:plasmo-bg-green-50 plasmo-rounded-lg plasmo-transition-colors"
              title="Add category">
              <svg
                className="plasmo-w-5 plasmo-h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setShowNewCategory(true)}
              className="plasmo-p-2 plasmo-text-blue-600 hover:plasmo-bg-blue-50 plasmo-rounded-lg plasmo-transition-colors"
              title="Create new category">
              <svg
                className="plasmo-w-5 plasmo-h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          )}
        </div>

        {}
        <div className="plasmo-flex-1 plasmo-min-w-0 plasmo-overflow-hidden">
          <CategorySuggestions
            noteTitle={title}
            noteContent={currentContent}
            availableCategories={categories.filter((cat) => cat !== category)}
            onCategorySelect={(selectedCategory) => {
              onCategoryChange(selectedCategory)
              setShowNewCategory(false)
            }}
            excludeCategories={[category]}
            minRelevanceScore={0}
            maxSuggestions={3}
          />
        </div>
      </div>

      {}
      <div className="plasmo-flex-1 plasmo-overflow-hidden plasmo-relative">
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
          onToolbarVisibilityChange={setIsToolbarVisible}
        />
      </div>

      {}
      <button
        onClick={handleSave}
        disabled={loading}
        className={`plasmo-fixed plasmo-right-6 plasmo-w-14 plasmo-h-14 plasmo-bg-blue-600 hover:plasmo-bg-blue-700 plasmo-text-white plasmo-rounded-full plasmo-shadow-lg hover:plasmo-shadow-xl plasmo-transition-all disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed plasmo-flex plasmo-items-center plasmo-justify-center plasmo-z-50 ${
          isToolbarVisible ? "plasmo-bottom-32" : "plasmo-bottom-6"
        }`}
        title={isEditing ? "Update note" : "Create note"}>
        {loading ? (
          <svg
            className="plasmo-w-6 plasmo-h-6 plasmo-animate-spin"
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
            className="plasmo-w-6 plasmo-h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </button>
    </div>
  )
}

export type { RichTextEditorRef }
