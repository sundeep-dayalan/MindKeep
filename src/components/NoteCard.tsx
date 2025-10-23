import { Color } from "@tiptap/extension-color"
import Highlight from "@tiptap/extension-highlight"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import { TextStyle } from "@tiptap/extension-text-style"
import Underline from "@tiptap/extension-underline"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import React from "react"

import type { Note } from "~services/db-service"

interface NoteCardProps {
  note: Note
  onEdit: (note: Note) => void
  onDelete: (id: string) => void
}

// Extract first image URL from TipTap JSON
const extractImageFromTipTap = (content: string): string | null => {
  try {
    const json = JSON.parse(content)

    // Recursively search for image nodes
    const findImage = (node: any): string | null => {
      if (node.type === "image" && node.attrs?.src) {
        return node.attrs.src
      }
      if (node.content && Array.isArray(node.content)) {
        for (const child of node.content) {
          const img = findImage(child)
          if (img) return img
        }
      }
      return null
    }

    return findImage(json)
  } catch {
    return null
  }
}

// Format time ago (just now, Xm ago, Oct 12)
const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) {
    return "just now"
  } else if (diffMins < 60) {
    return `${diffMins}m`
  } else if (diffHours < 24) {
    return `${diffHours}h`
  } else {
    // More than 24 hours - show month and date
    const date = new Date(timestamp)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    })
  }
}

// Truncate text with ellipsis
const truncateText = (text: string, maxWidthPercent: number): string => {
  // Simple character-based truncation (max ~40 chars for 80%, ~15 chars for 25%)
  const maxChars = maxWidthPercent === 80 ? 40 : 15
  if (text.length > maxChars) {
    return text.slice(0, maxChars - 3) + "..."
  }
  return text
}

// TipTap Read-Only Preview Component
const TipTapPreview = ({ content }: { content: string }) => {
  let parsedContent
  try {
    parsedContent = JSON.parse(content)
  } catch {
    parsedContent = content
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "plasmo-text-blue-600 plasmo-underline"
        }
      }),
      Image.configure({
        inline: true,
        HTMLAttributes: {
          class: "plasmo-hidden" // Hide images in preview
        }
      })
    ],
    content: parsedContent,
    editable: false,
    editorProps: {
      attributes: {
        class:
          "plasmo-text-sm plasmo-text-slate-700 plasmo-leading-relaxed !plasmo-bg-transparent"
      }
    }
  })

  if (!editor) {
    return null
  }

  return (
    <div className="plasmo-overflow-hidden plasmo-h-full plasmo-pointer-events-none [&_.ProseMirror]:!plasmo-bg-transparent [&_.ProseMirror]:plasmo-outline-none">
      <EditorContent editor={editor} />
    </div>
  )
}

export function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const handleCardClick = () => {
    onEdit(note)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(note.id)
  }

  const imageUrl = extractImageFromTipTap(note.content)
  const timeAgo = formatTimeAgo(note.updatedAt)
  const truncatedTitle = truncateText(note.title, 80)
  const truncatedCategory = truncateText(note.category, 25)

  return (
    <div
      onClick={handleCardClick}
      className="plasmo-relative plasmo-group plasmo-cursor-pointer plasmo-transition-all plasmo-duration-200 hover:plasmo-shadow-lg plasmo-bg-white plasmo-shadow-sm plasmo-h-full plasmo-min-h-[200px]"
      style={{
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow:
          "inset 0 0 0 1px rgba(59, 130, 246, 0.5), 0 1px 2px 0 rgb(0 0 0 / 0.05)"
      }}>
      {/* Delete button - only show on hover */}
      <button
        onClick={handleDelete}
        className="plasmo-absolute plasmo-top-2 plasmo-right-2 plasmo-z-30 plasmo-opacity-0 group-hover:plasmo-opacity-100 plasmo-transition-opacity plasmo-duration-200 plasmo-p-2 plasmo-bg-red-500/80 plasmo-backdrop-blur-md plasmo-rounded-full plasmo-text-white hover:plasmo-bg-red-600/90"
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

      {imageUrl ? (
        // Image background with overlay
        <>
          <img
            src={imageUrl}
            alt={note.title}
            className="plasmo-absolute plasmo-inset-0 plasmo-w-full plasmo-h-full plasmo-object-cover"
            style={{ borderRadius: "12px" }}
          />

          {/* Layered gradient blur effect - 0% blur at top, 100% blur at bottom */}
          <div className="plasmo-absolute plasmo-bottom-0 plasmo-left-0 plasmo-right-0 plasmo-h-28 plasmo-pointer-events-none">
            <div className="plasmo-absolute plasmo-inset-0 plasmo-bg-gradient-to-t plasmo-from-black/80 plasmo-via-black/40 plasmo-to-transparent" />
            <div
              className="plasmo-absolute plasmo-bottom-0 plasmo-left-0 plasmo-right-0 plasmo-h-20 plasmo-backdrop-blur-[8px]"
              style={{
                maskImage: "linear-gradient(to top, black, transparent)"
              }}
            />
            <div
              className="plasmo-absolute plasmo-bottom-0 plasmo-left-0 plasmo-right-0 plasmo-h-16 plasmo-backdrop-blur-[4px]"
              style={{
                maskImage: "linear-gradient(to top, black 50%, transparent)"
              }}
            />
          </div>

          {/* Text overlay */}
          <div className="plasmo-absolute plasmo-inset-0 plasmo-flex plasmo-flex-col plasmo-justify-end plasmo-p-3 plasmo-text-white plasmo-z-10">
            <h3 className="plasmo-font-semibold plasmo-text-sm plasmo-line-clamp-1 plasmo-mb-1 plasmo-drop-shadow-lg">
              {truncatedTitle}
            </h3>
            <p className="plasmo-text-xs plasmo-line-clamp-2 plasmo-mb-2 plasmo-opacity-95 plasmo-drop-shadow-md">
              {note.contentPlaintext || "No content"}
            </p>
            <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-text-xs plasmo-drop-shadow-md">
              <span className="plasmo-font-medium plasmo-truncate plasmo-max-w-[25%]">
                {truncatedCategory}
              </span>
              <span className="plasmo-opacity-90">{timeAgo}</span>
            </div>
          </div>
        </>
      ) : (
        // No image - show TipTap preview with simple white background
        <div
          className="plasmo-relative plasmo-h-full plasmo-bg-white plasmo-flex plasmo-flex-col"
          style={{ borderRadius: "12px", overflow: "hidden" }}>
          {/* TipTap preview fills remaining space */}
          <div className="plasmo-flex-1 plasmo-p-3 plasmo-overflow-hidden">
            <TipTapPreview content={note.content} />
          </div>

          {/* Solid white background for text - clean and simple */}
          <div className="plasmo-bg-white plasmo-border-t plasmo-border-slate-100 plasmo-flex-shrink-0">
            <div className="plasmo-p-3">
              <h3 className="plasmo-font-semibold plasmo-text-sm plasmo-line-clamp-1 plasmo-mb-1 plasmo-text-slate-900">
                {truncatedTitle}
              </h3>
              <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-text-xs plasmo-text-slate-600">
                <span className="plasmo-font-medium plasmo-truncate plasmo-max-w-[25%]">
                  {truncatedCategory}
                </span>
                <span>{timeAgo}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
