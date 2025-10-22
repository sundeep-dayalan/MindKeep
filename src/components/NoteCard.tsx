import React from "react"

import type { Note } from "~services/db-service"

import { BentoGridItem } from "./ui/bento-grid"

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

// Icon component for category
const CategoryIcon = ({ category }: { category: string }) => {
  const icon = getCategoryIcon(category)
  return (
    <div className="plasmo-h-4 plasmo-w-4 plasmo-text-neutral-500">{icon}</div>
  )
}

// Get icon based on category
const getCategoryIcon = (category: string) => {
  const lowerCategory = category.toLowerCase()

  if (lowerCategory.includes("work") || lowerCategory.includes("project")) {
    return (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    )
  } else if (
    lowerCategory.includes("personal") ||
    lowerCategory.includes("note")
  ) {
    return (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    )
  } else if (lowerCategory.includes("code") || lowerCategory.includes("tech")) {
    return (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
      </svg>
    )
  } else {
    return (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    )
  }
}

// Header component - image or simple preview
const NoteHeader = ({ note }: { note: Note }) => {
  const imageUrl = extractImageFromTipTap(note.content)
  const formattedDate = new Date(note.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  })

  if (imageUrl) {
    return (
      <div className="plasmo-w-full plasmo-h-20 plasmo-rounded-md plasmo-overflow-hidden plasmo-relative plasmo-flex-shrink-0">
        <img
          src={imageUrl}
          alt={note.title}
          className="plasmo-w-full plasmo-h-full plasmo-object-cover"
        />
        <div className="plasmo-absolute plasmo-bottom-1 plasmo-left-1 plasmo-right-1 plasmo-flex plasmo-items-center plasmo-justify-between">
          <span className="plasmo-text-xs plasmo-px-2 plasmo-py-0.5 plasmo-bg-blue-100 plasmo-text-blue-700 plasmo-rounded plasmo-font-medium">
            {note.category}
          </span>
          <span className="plasmo-text-xs plasmo-px-2 plasmo-py-0.5 plasmo-bg-white/90 plasmo-text-slate-600 plasmo-rounded plasmo-backdrop-blur-sm">
            {formattedDate}
          </span>
        </div>
      </div>
    )
  }

  // No image - just show category and date
  return (
    <div className="plasmo-w-full plasmo-flex plasmo-items-center plasmo-justify-between plasmo-py-0.5">
      <span className="plasmo-text-xs plasmo-px-2 plasmo-py-0.5 plasmo-bg-blue-100 plasmo-text-blue-700 plasmo-rounded">
        {note.category}
      </span>
      <span className="plasmo-text-xs plasmo-text-slate-400">
        {formattedDate}
      </span>
    </div>
  )
}

export function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const handleCardClick = () => {
    onEdit(note)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(note)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(note.id)
  }

  return (
    <div className="plasmo-relative plasmo-group">
      {/* Action buttons overlay */}
      <div className="plasmo-absolute plasmo-top-2 plasmo-right-2 plasmo-z-20 plasmo-opacity-0 group-hover:plasmo-opacity-100 plasmo-transition-opacity plasmo-duration-200 plasmo-flex plasmo-gap-1">
        <button
          onClick={handleEdit}
          className="plasmo-p-1.5 plasmo-bg-white plasmo-text-blue-600 hover:plasmo-bg-blue-50 plasmo-rounded plasmo-shadow-md plasmo-transition-colors"
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
          onClick={handleDelete}
          className="plasmo-p-1.5 plasmo-bg-white plasmo-text-red-600 hover:plasmo-bg-red-50 plasmo-rounded plasmo-shadow-md plasmo-transition-colors"
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

      <BentoGridItem
        title={note.title}
        description={note.contentPlaintext?.slice(0, 80) || "No content"}
        header={<NoteHeader note={note} />}
        icon={<CategoryIcon category={note.category} />}
        onClick={handleCardClick}
      />
    </div>
  )
}
