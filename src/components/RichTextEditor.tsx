import { Color } from "@tiptap/extension-color"
import Highlight from "@tiptap/extension-highlight"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Subscript from "@tiptap/extension-subscript"
import Superscript from "@tiptap/extension-superscript"
import { Table } from "@tiptap/extension-table"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import { TableRow } from "@tiptap/extension-table-row"
import TextAlign from "@tiptap/extension-text-align"
import { TextStyle } from "@tiptap/extension-text-style"
import Underline from "@tiptap/extension-underline"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState
} from "react"

interface RichTextEditorProps {
  initialContent?: string // JSON string or plain text
  placeholder?: string
  onUpdate?: (plainText: string, json: any) => void
  onSubmit?: () => void // New prop to handle Enter key press
  onSummarize?: () => void
  isSummarizing?: boolean
  showToolbar?: boolean // New prop to control toolbar visibility
  compact?: boolean // New prop for compact mode (smaller padding, simpler styling)
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
>(
  (
    {
      initialContent,
      placeholder = "Start typing...",
      onUpdate,
      onSubmit,
      onSummarize,
      isSummarizing,
      showToolbar = true,
      compact = false
    },
    ref
  ) => {
    const [showLinkInput, setShowLinkInput] = useState(false)
    const [linkUrl, setLinkUrl] = useState("")
    const [showImageInput, setShowImageInput] = useState(false)
    const [imageUrl, setImageUrl] = useState("")

    const editor = useEditor({
      extensions: [
        StarterKit,
        Underline,
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({
          types: ["heading", "paragraph"]
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: "plasmo-text-blue-600 plasmo-underline"
          }
        }),
        Image.configure({
          inline: true,
          HTMLAttributes: {
            class: "plasmo-max-w-full plasmo-h-auto plasmo-rounded"
          }
        }),
        Table.configure({
          resizable: true,
          HTMLAttributes: {
            class: "plasmo-border-collapse plasmo-table-auto plasmo-w-full"
          }
        }),
        TableRow,
        TableHeader,
        TableCell,
        Superscript,
        Subscript
      ],
      content: initialContent || "",
      editorProps: {
        attributes: {
          class:
            "plasmo-prose plasmo-prose-sm plasmo-max-w-none plasmo-min-h-[240px] plasmo-px-3 plasmo-py-2 plasmo-text-slate-900 focus:plasmo-outline-none"
        },
        handleKeyDown: (view, event) => {
          // Handle Enter key to submit
          if (event.key === "Enter" && !event.shiftKey && onSubmit) {
            event.preventDefault()
            onSubmit()
            return true
          }
          return false
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

    const addLink = useCallback(() => {
      if (linkUrl && editor) {
        editor
          .chain()
          .focus()
          .extendMarkRange("link")
          .setLink({ href: linkUrl })
          .run()
        setLinkUrl("")
        setShowLinkInput(false)
      }
    }, [editor, linkUrl])

    const addImage = useCallback(() => {
      if (imageUrl && editor) {
        editor.chain().focus().setImage({ src: imageUrl }).run()
        setImageUrl("")
        setShowImageInput(false)
      }
    }, [editor, imageUrl])

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
      <div
        className={`plasmo-bg-white plasmo-overflow-hidden plasmo-transition-all ${
          compact
            ? "plasmo-border-none"
            : "plasmo-border plasmo-border-slate-300 plasmo-rounded-lg focus-within:plasmo-ring-2 focus-within:plasmo-ring-blue-500 focus-within:plasmo-border-blue-500"
        }`}>
        {/* Toolbar - only show if showToolbar is true */}
        {showToolbar && (
          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-1 plasmo-p-2 plasmo-bg-slate-50 plasmo-border-b plasmo-border-slate-200">
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

            <div className="plasmo-w-px plasmo-bg-slate-300 plasmo-mx-1" />

            {/* Heading Dropdown */}
            <select
              onChange={(e) => {
                const level = e.target.value
                if (level === "p") {
                  editor.chain().focus().setParagraph().run()
                } else {
                  editor
                    .chain()
                    .focus()
                    .toggleHeading({ level: parseInt(level) as any })
                    .run()
                }
              }}
              value={
                editor.isActive("heading", { level: 1 })
                  ? "1"
                  : editor.isActive("heading", { level: 2 })
                    ? "2"
                    : editor.isActive("heading", { level: 3 })
                      ? "3"
                      : "p"
              }
              className="plasmo-px-2 plasmo-py-1 plasmo-rounded plasmo-border plasmo-border-slate-300 plasmo-text-sm plasmo-bg-white hover:plasmo-bg-slate-50"
              title="Text Style">
              <option value="p">Normal</option>
              <option value="1">Heading 1</option>
              <option value="2">Heading 2</option>
              <option value="3">Heading 3</option>
            </select>

            <div className="plasmo-w-px plasmo-bg-slate-300 plasmo-mx-1" />

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
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z" />
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
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z" />
              </svg>
            </button>

            {/* Underline */}
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
                editor.isActive("underline")
                  ? "plasmo-bg-slate-900 plasmo-text-white"
                  : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
              }`}
              title="Underline (Ctrl+U)">
              <svg
                className="plasmo-w-4 plasmo-h-4"
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z" />
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
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z" />
              </svg>
            </button>

            {/* Code */}
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
                editor.isActive("code")
                  ? "plasmo-bg-slate-900 plasmo-text-white"
                  : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
              }`}
              title="Inline Code">
              <svg
                className="plasmo-w-4 plasmo-h-4"
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
              </svg>
            </button>

            <div className="plasmo-w-px plasmo-bg-slate-300 plasmo-mx-1" />

            {/* Link */}
            <button
              onClick={() => {
                if (editor.isActive("link")) {
                  editor.chain().focus().unsetLink().run()
                } else {
                  setShowLinkInput(!showLinkInput)
                }
              }}
              className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
                editor.isActive("link")
                  ? "plasmo-bg-slate-900 plasmo-text-white"
                  : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
              }`}
              title="Insert Link">
              <svg
                className="plasmo-w-4 plasmo-h-4"
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
              </svg>
            </button>

            {/* Image */}
            <button
              onClick={() => setShowImageInput(!showImageInput)}
              className="plasmo-p-2 plasmo-rounded plasmo-text-slate-700 hover:plasmo-bg-slate-200 plasmo-transition-colors"
              title="Insert Image">
              <svg
                className="plasmo-w-4 plasmo-h-4"
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
              </svg>
            </button>

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
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" />
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
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z" />
              </svg>
            </button>

            <div className="plasmo-w-px plasmo-bg-slate-300 plasmo-mx-1" />

            {/* Text Align Left */}
            <button
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
                editor.isActive({ textAlign: "left" })
                  ? "plasmo-bg-slate-900 plasmo-text-white"
                  : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
              }`}
              title="Align Left">
              <svg
                className="plasmo-w-4 plasmo-h-4"
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z" />
              </svg>
            </button>

            {/* Text Align Center */}
            <button
              onClick={() =>
                editor.chain().focus().setTextAlign("center").run()
              }
              className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
                editor.isActive({ textAlign: "center" })
                  ? "plasmo-bg-slate-900 plasmo-text-white"
                  : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
              }`}
              title="Align Center">
              <svg
                className="plasmo-w-4 plasmo-h-4"
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z" />
              </svg>
            </button>

            {/* Text Align Right */}
            <button
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
                editor.isActive({ textAlign: "right" })
                  ? "plasmo-bg-slate-900 plasmo-text-white"
                  : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
              }`}
              title="Align Right">
              <svg
                className="plasmo-w-4 plasmo-h-4"
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z" />
              </svg>
            </button>

            {/* Text Align Justify */}
            <button
              onClick={() =>
                editor.chain().focus().setTextAlign("justify").run()
              }
              className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
                editor.isActive({ textAlign: "justify" })
                  ? "plasmo-bg-slate-900 plasmo-text-white"
                  : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
              }`}
              title="Justify">
              <svg
                className="plasmo-w-4 plasmo-h-4"
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z" />
              </svg>
            </button>

            <div className="plasmo-w-px plasmo-bg-slate-300 plasmo-mx-1" />

            {/* Superscript */}
            <button
              onClick={() => editor.chain().focus().toggleSuperscript().run()}
              className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
                editor.isActive("superscript")
                  ? "plasmo-bg-slate-900 plasmo-text-white"
                  : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
              }`}
              title="Superscript">
              <span className="plasmo-text-xs plasmo-font-semibold">X²</span>
            </button>

            {/* Subscript */}
            <button
              onClick={() => editor.chain().focus().toggleSubscript().run()}
              className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
                editor.isActive("subscript")
                  ? "plasmo-bg-slate-900 plasmo-text-white"
                  : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
              }`}
              title="Subscript">
              <span className="plasmo-text-xs plasmo-font-semibold">X₂</span>
            </button>

            <div className="plasmo-w-px plasmo-bg-slate-300 plasmo-mx-1" />

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
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
              </svg>
            </button>

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
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
              </svg>
            </button>

            {/* Horizontal Rule */}
            <button
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              className="plasmo-p-2 plasmo-rounded plasmo-text-slate-700 hover:plasmo-bg-slate-200 plasmo-transition-colors"
              title="Horizontal Line">
              <svg
                className="plasmo-w-4 plasmo-h-4"
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M19 13H5v-2h14v2z" />
              </svg>
            </button>

            <div className="plasmo-w-px plasmo-bg-slate-300 plasmo-mx-1" />

            {/* Insert Table */}
            <button
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                  .run()
              }
              className="plasmo-p-2 plasmo-rounded plasmo-text-slate-700 hover:plasmo-bg-slate-200 plasmo-transition-colors"
              title="Insert Table (3x3)">
              <svg
                className="plasmo-w-4 plasmo-h-4"
                fill="currentColor"
                viewBox="0 0 24 24">
                <path d="M10 10.02h5V21h-5zM17 21h3c1.1 0 2-.9 2-2v-9h-5v11zm3-18H5c-1.1 0-2 .9-2 2v3h19V5c0-1.1-.9-2-2-2zM3 19c0 1.1.9 2 2 2h3V10.02H3V19z" />
              </svg>
            </button>

            {/* Table Controls - Only show when inside a table */}
            {editor.isActive("table") && (
              <>
                <button
                  onClick={() => editor.chain().focus().addColumnBefore().run()}
                  className="plasmo-p-2 plasmo-rounded plasmo-text-slate-700 hover:plasmo-bg-slate-200 plasmo-transition-colors"
                  title="Add Column Before">
                  <span className="plasmo-text-xs plasmo-font-semibold">
                    +Col
                  </span>
                </button>

                <button
                  onClick={() => editor.chain().focus().addRowBefore().run()}
                  className="plasmo-p-2 plasmo-rounded plasmo-text-slate-700 hover:plasmo-bg-slate-200 plasmo-transition-colors"
                  title="Add Row Before">
                  <span className="plasmo-text-xs plasmo-font-semibold">
                    +Row
                  </span>
                </button>

                <button
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  disabled={!editor.can().deleteColumn()}
                  className="plasmo-p-2 plasmo-rounded plasmo-text-red-600 hover:plasmo-bg-red-50 plasmo-transition-colors disabled:plasmo-opacity-30"
                  title="Delete Column">
                  <span className="plasmo-text-xs plasmo-font-semibold">
                    -Col
                  </span>
                </button>

                <button
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  disabled={!editor.can().deleteRow()}
                  className="plasmo-p-2 plasmo-rounded plasmo-text-red-600 hover:plasmo-bg-red-50 plasmo-transition-colors disabled:plasmo-opacity-30"
                  title="Delete Row">
                  <span className="plasmo-text-xs plasmo-font-semibold">
                    -Row
                  </span>
                </button>

                <button
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="plasmo-p-2 plasmo-rounded plasmo-text-red-600 hover:plasmo-bg-red-50 plasmo-transition-colors"
                  title="Delete Table">
                  <svg
                    className="plasmo-w-4 plasmo-h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                </button>

                <button
                  onClick={() =>
                    editor.chain().focus().toggleHeaderCell().run()
                  }
                  className={`plasmo-p-2 plasmo-rounded plasmo-transition-colors ${
                    editor.isActive("tableHeader")
                      ? "plasmo-bg-slate-900 plasmo-text-white"
                      : "plasmo-text-slate-700 hover:plasmo-bg-slate-200"
                  }`}
                  title="Toggle Header Cell">
                  <span className="plasmo-text-xs plasmo-font-semibold">
                    TH
                  </span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Link Input Dialog */}
        {showToolbar && showLinkInput && (
          <div className="plasmo-p-3 plasmo-bg-blue-50 plasmo-border-b plasmo-border-slate-200 plasmo-flex plasmo-gap-2 plasmo-items-center">
            <input
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addLink()
                } else if (e.key === "Escape") {
                  setShowLinkInput(false)
                  setLinkUrl("")
                }
              }}
              className="plasmo-flex-1 plasmo-px-3 plasmo-py-1.5 plasmo-border plasmo-border-slate-300 plasmo-rounded plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500"
              autoFocus
            />
            <button
              onClick={addLink}
              className="plasmo-px-3 plasmo-py-1.5 plasmo-bg-blue-600 plasmo-text-white plasmo-rounded plasmo-text-sm hover:plasmo-bg-blue-700 plasmo-transition-colors">
              Add Link
            </button>
            <button
              onClick={() => {
                setShowLinkInput(false)
                setLinkUrl("")
              }}
              className="plasmo-px-3 plasmo-py-1.5 plasmo-bg-slate-200 plasmo-text-slate-700 plasmo-rounded plasmo-text-sm hover:plasmo-bg-slate-300 plasmo-transition-colors">
              Cancel
            </button>
          </div>
        )}

        {/* Image Input Dialog */}
        {showToolbar && showImageInput && (
          <div className="plasmo-p-3 plasmo-bg-green-50 plasmo-border-b plasmo-border-slate-200 plasmo-flex plasmo-gap-2 plasmo-items-center">
            <input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addImage()
                } else if (e.key === "Escape") {
                  setShowImageInput(false)
                  setImageUrl("")
                }
              }}
              className="plasmo-flex-1 plasmo-px-3 plasmo-py-1.5 plasmo-border plasmo-border-slate-300 plasmo-rounded plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-green-500"
              autoFocus
            />
            <button
              onClick={addImage}
              className="plasmo-px-3 plasmo-py-1.5 plasmo-bg-green-600 plasmo-text-white plasmo-rounded plasmo-text-sm hover:plasmo-bg-green-700 plasmo-transition-colors">
              Add Image
            </button>
            <button
              onClick={() => {
                setShowImageInput(false)
                setImageUrl("")
              }}
              className="plasmo-px-3 plasmo-py-1.5 plasmo-bg-slate-200 plasmo-text-slate-700 plasmo-rounded plasmo-text-sm hover:plasmo-bg-slate-300 plasmo-transition-colors">
              Cancel
            </button>
          </div>
        )}

        {/* Editor Content */}
        <div
          className={
            compact
              ? "plasmo-min-h-[40px] plasmo-max-h-[200px] plasmo-overflow-y-auto compact-editor"
              : "plasmo-min-h-[240px] plasmo-max-h-[400px] plasmo-overflow-y-auto"
          }>
          <EditorContent editor={editor} />
        </div>

        {/* Summarize Button */}
        {onSummarize && showToolbar && (
          <div className="plasmo-px-3 plasmo-py-1.5 plasmo-bg-slate-50 plasmo-border-t plasmo-border-slate-200 plasmo-flex plasmo-justify-end plasmo-items-center">
            <button
              onClick={onSummarize}
              disabled={isSummarizing}
              className="plasmo-px-3 plasmo-py-1 plasmo-text-xs plasmo-text-purple-600 hover:plasmo-bg-purple-50 plasmo-rounded plasmo-font-medium disabled:plasmo-opacity-40 disabled:plasmo-cursor-not-allowed plasmo-transition-colors plasmo-flex plasmo-items-center plasmo-gap-1.5"
              title="Summarize content using AI">
              {isSummarizing ? (
                <>
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
                  Summarizing...
                </>
              ) : (
                <>
                  <svg
                    className="plasmo-w-4 plasmo-h-4"
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
                  Summarize
                </>
              )}
            </button>
          </div>
        )}
      </div>
    )
  }
)

RichTextEditor.displayName = "RichTextEditor"
