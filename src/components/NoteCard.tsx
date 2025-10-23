import { BlurFade } from "@/components/ui/blur-fade"
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

import { LinkPreview } from "./ui/LinkPreview"

interface NoteCardProps {
  note: Note
  onEdit: (note: Note) => void
  onDelete: (id: string) => void
}

// Fresh, vibrant color palette for note cards
const COLOR_PALETTE = [
  { bg: "#E0F2FE", border: "#7DD3FC", text: "#0C4A6E" }, // Sky Blue
  { bg: "#FCE7F3", border: "#F9A8D4", text: "#831843" }, // Pink
  { bg: "#FEF3C7", border: "#FCD34D", text: "#78350F" }, // Amber
  { bg: "#DCFCE7", border: "#86EFAC", text: "#14532D" }, // Green
  { bg: "#E9D5FF", border: "#D8B4FE", text: "#581C87" }, // Purple
  { bg: "#FFEDD5", border: "#FDBA74", text: "#7C2D12" } // Orange
]

// Generate consistent color based on note ID
const getColorForNote = (noteId: string): (typeof COLOR_PALETTE)[0] => {
  // Simple hash function to get consistent index
  let hash = 0
  for (let i = 0; i < noteId.length; i++) {
    hash = (hash << 5) - hash + noteId.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }
  const index = Math.abs(hash) % COLOR_PALETTE.length
  return COLOR_PALETTE[index]
}

// Extract ALL image URLs from TipTap JSON
const extractImagesFromTipTap = (content: string): string[] => {
  try {
    const json = JSON.parse(content)
    const images: string[] = []

    // Recursively search for image nodes
    const findImages = (node: any): void => {
      if (node.type === "image" && node.attrs?.src) {
        images.push(node.attrs.src)
      }
      if (node.content && Array.isArray(node.content)) {
        for (const child of node.content) {
          findImages(child)
        }
      }
    }

    findImages(json)
    return images
  } catch {
    return []
  }
}

// Format time ago (just now, Xm ago, Oct 12)
const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) {
    return "Just now"
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

  const imageUrls = extractImagesFromTipTap(note.content)
  const timeAgo = formatTimeAgo(note.updatedAt)
  const truncatedTitle = truncateText(note.title, 80)
  const truncatedCategory = truncateText(note.category, 25)
  const noteColor = getColorForNote(note.id)

  // Show up to 4 images in avatar circles
  const displayImages = imageUrls.slice(0, 4)
  const remainingCount = imageUrls.length > 4 ? imageUrls.length - 4 : 0

  return (
    <BlurFade className="plasmo-h-full plasmo-w-full">
      <div
        onClick={handleCardClick}
        className="plasmo-relative plasmo-group plasmo-cursor-pointer plasmo-transition-all plasmo-duration-200 hover:plasmo-shadow-lg plasmo-shadow-sm plasmo-min-h-[200px]"
        style={{
          borderRadius: "12px",
          overflow: "hidden",
          backgroundColor: noteColor.bg,
          boxShadow: `inset 0 0 0 1.5px ${noteColor.border}, 0 1px 2px 0 rgb(0 0 0 / 0.05)`,
          height: "100%",
          width: "100%"
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

        {/* TipTap preview - fills all space except bottom 65px */}
        <div
          className="plasmo-absolute plasmo-top-0 plasmo-left-0 plasmo-right-0 plasmo-p-3 plasmo-overflow-hidden"
          style={{
            bottom: "65px",
            borderTopLeftRadius: "12px",
            borderTopRightRadius: "12px",
            backgroundColor: noteColor.bg
          }}>
          <TipTapPreview content={note.content} />
        </div>

        {/* Image avatars in bottom-right corner (if images exist) */}
        {displayImages.length > 0 && (
          <div className="plasmo-absolute plasmo-bottom-[70px] plasmo-right-2 plasmo-z-20 plasmo-flex plasmo-items-center plasmo-flex-row-reverse">
            {remainingCount > 0 && (
              <div
                className="plasmo-w-10 plasmo-h-10 plasmo-rounded-md plasmo-border-2 plasmo-border-white plasmo-bg-slate-700 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-white plasmo-text-xs plasmo-font-semibold"
                style={{
                  marginLeft: "-10px",
                  zIndex: 0
                }}>
                +{remainingCount}
              </div>
            )}
            {displayImages.map((imgUrl, index) => (
              <LinkPreview url={imgUrl}>
                <div
                  key={index}
                  className="plasmo-w-10 plasmo-h-10 plasmo-rounded-md plasmo-border-2 plasmo-border-white plasmo-overflow-hidden plasmo-bg-white"
                  style={{
                    marginLeft: index > 0 || remainingCount > 0 ? "-10px" : "0",
                    zIndex: displayImages.length - index
                  }}>
                  <img
                    src={imgUrl}
                    alt=""
                    className="plasmo-w-full plasmo-h-full plasmo-object-cover"
                    loading="lazy"
                  />
                </div>
              </LinkPreview>
            ))}
          </div>
        )}

        {/* Fixed title section at bottom - always visible */}
        <div
          className="plasmo-absolute plasmo-bottom-0 plasmo-left-0 plasmo-right-0 plasmo-z-10"
          style={{
            height: "65px",
            borderBottomLeftRadius: "12px",
            borderBottomRightRadius: "12px",
            backgroundColor: noteColor.bg,
            borderTop: `1px solid ${noteColor.border}`
          }}>
          <div className="plasmo-px-3 plasmo-py-2 plasmo-h-full plasmo-flex plasmo-flex-col plasmo-justify-center">
            <h3
              className="plasmo-font-semibold plasmo-text-sm plasmo-line-clamp-1 plasmo-mb-1.5"
              style={{ color: noteColor.text }}>
              {truncatedTitle}
            </h3>
            <div
              className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-text-xs"
              style={{ color: noteColor.text, opacity: 0.8 }}>
              <div 
                className="plasmo-font-medium plasmo-truncate plasmo-max-w-[60%] plasmo-px-2 plasmo-py-1 plasmo-rounded-full"
                style={{ 
                  backgroundColor: noteColor.border + '40', // 25% opacity
                  color: noteColor.text
                }}>
                {truncatedCategory}
              </div>
              <span className="plasmo-flex-shrink-0 plasmo-ml-2">
                {timeAgo}
              </span>
            </div>
          </div>
        </div>
      </div>
    </BlurFade>
  )
}
