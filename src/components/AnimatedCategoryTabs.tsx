import type { Note } from "~services/db-service"

import { NoteCard } from "./NoteCard"
import { BentoGrid } from "./ui/bento-grid"
import { Tabs } from "./ui/tabs"

interface AnimatedCategoryTabsProps {
  categories: string[]
  notes: Note[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
  onEdit: (note: Note) => void
  onDelete: (id: string) => void
  loading: boolean
}

export function AnimatedCategoryTabs({
  categories,
  notes,
  selectedCategory,
  onCategoryChange,
  onEdit,
  onDelete,
  loading
}: AnimatedCategoryTabsProps) {
  // Filter notes for each category
  const getNotesForCategory = (category: string) => {
    if (category === "all") {
      return notes
    }
    return notes.filter((note) => note.category === category)
  }

  // Build tabs array with count badges
  const allNotesCount = notes.length
  const tabs = [
    {
      title: "All",
      value: "all",
      count: allNotesCount,
      content: (
        <div className="plasmo-w-full plasmo-h-full plasmo-px-4 plasmo-pt-4">
          <NotesContent
            notes={getNotesForCategory("all")}
            loading={loading}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      )
    },
    ...categories.map((category) => {
      const categoryNotes = getNotesForCategory(category)
      return {
        title: category,
        value: category,
        count: categoryNotes.length,
        content: (
          <div className="plasmo-w-full plasmo-h-full plasmo-px-4 plasmo-pt-4">
            <NotesContent
              notes={categoryNotes}
              loading={loading}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        )
      }
    })
  ]

  return (
    <div className="plasmo-w-full plasmo-h-full plasmo-flex plasmo-flex-col plasmo-overflow-hidden">
      <Tabs
        tabs={tabs}
        containerClassName=""
        activeTabClassName="plasmo-bg-slate-800"
        tabClassName=""
        contentClassName=""
        onTabChange={(tabValue) => {
          onCategoryChange(tabValue)
        }}
      />
    </div>
  )
}

// Separate component for notes content
function NotesContent({
  notes,
  loading,
  onEdit,
  onDelete
}: {
  notes: Note[]
  loading: boolean
  onEdit: (note: Note) => void
  onDelete: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-py-12">
        <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-gap-3">
          <div className="plasmo-w-10 plasmo-h-10 plasmo-border-4 plasmo-border-slate-200 plasmo-border-t-slate-800 plasmo-rounded-full plasmo-animate-spin" />
          <p className="plasmo-text-sm plasmo-text-slate-500">
            Loading notes...
          </p>
        </div>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-py-12">
        <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-gap-2 plasmo-text-center">
          <svg
            className="plasmo-w-12 plasmo-h-12 plasmo-text-slate-300"
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
          <p className="plasmo-text-sm plasmo-text-slate-500 plasmo-font-medium">
            No notes in this category
          </p>
          <p className="plasmo-text-xs plasmo-text-slate-400">
            Create a new note to get started
          </p>
        </div>
      </div>
    )
  }

  return (
    <BentoGrid>
      {notes.map((note, index) => {
        // Dynamic column spanning for visual variety
        // Every 7th card (index 6, 13, 20...) spans 2 columns on tablet+, 3 columns on wide
        const isWideCard = (index + 1) % 7 === 0

        // Responsive column spanning:
        // Default (2 cols): Wide cards span 2, normal cards span 1
        // Desktop (3 cols): Wide cards span 3, normal cards span 1
        const colSpanClass = isWideCard
          ? "plasmo-col-span-2 lg:plasmo-col-span-3"
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
