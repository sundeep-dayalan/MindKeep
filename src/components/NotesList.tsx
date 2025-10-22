import type { Note } from "~services/db-service"

import { NoteCard } from "./NoteCard"
import { BentoGrid } from "./ui/bento-grid"

interface NotesListProps {
  notes: Note[]
  loading: boolean
  onEdit: (note: Note) => void
  onDelete: (id: string) => void
  onCreateNew: () => void
}

export function NotesList({
  notes,
  loading,
  onEdit,
  onDelete,
  onCreateNew
}: NotesListProps) {
  if (loading) {
    return (
      <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-py-12">
        <div className="plasmo-text-center">
          <div className="plasmo-w-12 plasmo-h-12 plasmo-border-4 plasmo-border-blue-200 plasmo-border-t-blue-600 plasmo-rounded-full plasmo-animate-spin plasmo-mx-auto plasmo-mb-4"></div>
          <p className="plasmo-text-slate-500 dark:plasmo-text-slate-400">
            Loading your notes...
          </p>
        </div>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-py-12">
        <div className="plasmo-text-center plasmo-max-w-md">
          <svg
            className="plasmo-w-16 plasmo-h-16 plasmo-mx-auto plasmo-mb-4 plasmo-text-slate-300 dark:plasmo-text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="plasmo-text-lg plasmo-font-semibold plasmo-text-slate-900 dark:plasmo-text-slate-100 plasmo-mb-2">
            No notes yet
          </h3>
          <p className="plasmo-text-slate-500 dark:plasmo-text-slate-400 plasmo-mb-6">
            Create your first note to get started with your second brain!
          </p>
          <button
            onClick={onCreateNew}
            className="plasmo-px-4 plasmo-py-2 plasmo-bg-blue-600 plasmo-text-white plasmo-rounded-lg hover:plasmo-bg-blue-700 plasmo-transition-colors plasmo-shadow-md hover:plasmo-shadow-lg">
            Create First Note
          </button>
        </div>
      </div>
    )
  }

  return (
    <BentoGrid className="plasmo-p-3">
      {notes.map((note, index) => {
        // Dynamic column spanning for visual variety
        // Every 7th card spans full width
        const isWideCard = (index + 1) % 7 === 0

        const colSpanClass = isWideCard
          ? "plasmo-col-span-1 sm:plasmo-col-span-2 lg:plasmo-col-span-3"
          : "plasmo-col-span-1"

        return (
          <div key={note.id} className={colSpanClass}>
            <NoteCard note={note} onEdit={onEdit} onDelete={onDelete} />
          </div>
        )
      })}
    </BentoGrid>
  )
}
