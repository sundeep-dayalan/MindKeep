import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { forwardRef, useEffect, useImperativeHandle } from "react"

interface RichTextEditorProps {
  initialContent?: string // JSON string or plain text
  placeholder?: string
  onUpdate?: (plainText: string, json: any) => void
}

export interface RichTextEditorRef {
  getText: () => string
  getJSON: () => any
  setContent: (content: string | any) => void
  focus: () => void
}

export const RichTextEditor = forwardRef<
  RichTextEditorRef,
  RichTextEditorProps
>(({ initialContent, placeholder = "Start typing...", onUpdate }, ref) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent || "",
    editorProps: {
      attributes: {
        class:
          "plasmo-prose plasmo-prose-sm plasmo-max-w-none plasmo-min-h-[240px] plasmo-px-3 plasmo-py-2 plasmo-text-slate-900 focus:plasmo-outline-none"
      }
    },
    onUpdate: ({ editor }) => {
      if (onUpdate) {
        const plainText = editor.getText()
        const json = editor.getJSON()
        onUpdate(plainText, json)
      }
    }
  })

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    getText: () => editor?.getText() || "",
    getJSON: () => editor?.getJSON() || null,
    setContent: (content: string | any) => {
      if (editor) {
        try {
          // Try to parse as JSON first
          if (typeof content === "string") {
            try {
              const parsed = JSON.parse(content)
              editor.commands.setContent(parsed)
            } catch {
              // If not JSON, treat as plain text or HTML
              editor.commands.setContent(content)
            }
          } else {
            editor.commands.setContent(content)
          }
        } catch (error) {
          console.error("Error setting content:", error)
        }
      }
    },
    focus: () => editor?.commands.focus()
  }))

  // Update content when initialContent changes
  useEffect(() => {
    if (editor && initialContent) {
      try {
        if (typeof initialContent === "string") {
          try {
            const parsed = JSON.parse(initialContent)
            editor.commands.setContent(parsed)
          } catch {
            editor.commands.setContent(initialContent)
          }
        } else {
          editor.commands.setContent(initialContent)
        }
      } catch (error) {
        console.error("Error setting initial content:", error)
      }
    }
  }, [initialContent, editor])

  if (!editor) {
    return null
  }

  return (
    <div className="plasmo-border plasmo-border-slate-300 plasmo-rounded-lg plasmo-bg-white plasmo-overflow-hidden focus-within:plasmo-ring-2 focus-within:plasmo-ring-blue-500 focus-within:plasmo-border-blue-500 plasmo-transition-all">
      {/* Toolbar */}
      <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-1 plasmo-p-2 plasmo-bg-slate-50 plasmo-border-b plasmo-border-slate-200">
        {/* Bold */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
            editor.isActive("bold")
              ? "plasmo-bg-slate-900 plasmo-text-white"
              : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
          } disabled:plasmo-opacity-30`}
          title="Bold (Ctrl+B)">
          <svg
            className="plasmo-w-4 plasmo-h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"
            />
          </svg>
        </button>

        {/* Italic */}
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
            editor.isActive("italic")
              ? "plasmo-bg-slate-900 plasmo-text-white"
              : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
          } disabled:plasmo-opacity-30`}
          title="Italic (Ctrl+I)">
          <svg
            className="plasmo-w-4 plasmo-h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 4h4M14 20h-4M15 4L9 20"
            />
          </svg>
        </button>

        {/* Strike */}
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
            editor.isActive("strike")
              ? "plasmo-bg-slate-900 plasmo-text-white"
              : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
          } disabled:plasmo-opacity-30`}
          title="Strikethrough">
          <svg
            className="plasmo-w-4 plasmo-h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12h18M9 5l6 14M15 5l-6 14"
            />
          </svg>
        </button>

        {/* Divider */}
        <div className="plasmo-w-px plasmo-bg-slate-300 plasmo-mx-1" />

        {/* Bullet List */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
            editor.isActive("bulletList")
              ? "plasmo-bg-slate-900 plasmo-text-white"
              : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
          }`}
          title="Bullet List">
          <svg
            className="plasmo-w-4 plasmo-h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Ordered List */}
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
            editor.isActive("orderedList")
              ? "plasmo-bg-slate-900 plasmo-text-white"
              : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
          }`}
          title="Numbered List">
          <svg
            className="plasmo-w-4 plasmo-h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
            />
          </svg>
        </button>

        {/* Code Block */}
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
            editor.isActive("codeBlock")
              ? "plasmo-bg-slate-900 plasmo-text-white"
              : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
          }`}
          title="Code Block">
          <svg
            className="plasmo-w-4 plasmo-h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        </button>

        {/* Divider */}
        <div className="plasmo-w-px plasmo-bg-slate-300 plasmo-mx-1" />

        {/* Blockquote */}
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
            editor.isActive("blockquote")
              ? "plasmo-bg-slate-900 plasmo-text-white"
              : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
          }`}
          title="Quote">
          <svg
            className="plasmo-w-4 plasmo-h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </button>

        {/* Horizontal Rule */}
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="plasmo-p-2 plasmo-rounded plasmo-text-slate-700 hover:plasmo-bg-slate-200 plasmo-transition-colors"
          title="Horizontal Line">
          <svg
            className="plasmo-w-4 plasmo-h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 12h14"
            />
          </svg>
        </button>

        {/* Divider */}
        <div className="plasmo-w-px plasmo-bg-slate-300 plasmo-mx-1" />

        {/* Undo */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className="plasmo-p-2 plasmo-rounded plasmo-text-slate-700 hover:plasmo-bg-slate-200 plasmo-transition-colors disabled:plasmo-opacity-30"
          title="Undo (Ctrl+Z)">
          <svg
            className="plasmo-w-4 plasmo-h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
        </button>

        {/* Redo */}
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className="plasmo-p-2 plasmo-rounded plasmo-text-slate-700 hover:plasmo-bg-slate-200 plasmo-transition-colors disabled:plasmo-opacity-30"
          title="Redo (Ctrl+Shift+Z)">
          <svg
            className="plasmo-w-4 plasmo-h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
            />
          </svg>
        </button>
      </div>

      {/* Editor Content */}
      <div className="plasmo-min-h-[240px] plasmo-max-h-[400px] plasmo-overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Character Count (optional) */}
      <div className="plasmo-px-3 plasmo-py-1.5 plasmo-bg-slate-50 plasmo-border-t plasmo-border-slate-200 plasmo-text-xs plasmo-text-slate-500">
        {editor.storage.characterCount?.characters() || 0} characters
      </div>
    </div>
  )
})

RichTextEditor.displayName = "RichTextEditor"
