import { BentoGrid, type BentoItem } from "react-bento"

import type { Note } from "~services/db-service"

import { NoteCard } from "./NoteCard"
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
        <div className="plasmo-w-full plasmo-h-full ">
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
          <div className="plasmo-w-full plasmo-h-full plasmo-pt-2">
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
        contentClassName="plasmo-h-full plasmo-overflow-auto"
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

  // Transform notes into BentoItem format
  const bentoItems: BentoItem[] = notes.map((note, index) => {
    // Calculate dynamic dimensions based on content
    const contentLength = note.contentPlaintext?.length || 0
    const hasImage = note.content?.includes('"type":"image"') || false

    // All cards are 1 column wide (2 column grid total)
    const width = 1

    // Dynamic height based on content length
    // More granular height distribution for better visual variety
    let height = 3 // Default: 2 rows (300px)

    if (hasImage) {
      // Images need more vertical space
      if (contentLength < 100) height = 3
      else if (contentLength < 300) height = 3
      else height = 4
    } else {
      // Text-only content
      if (contentLength < 150) height = 3
      else if (contentLength < 350) height = 3
      else if (contentLength < 600) height = 4
      else height = 5
    }

    return {
      id: index,
      title: note.title,
      width,
      height,
      element: (
        <div style={{ padding: 0, margin: 0, height: "100%", width: "100%" }}>
          <NoteCard note={note} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )
    }
  })

  return (
    <BentoGrid
      items={bentoItems}
      gridCols={2}
      rowHeight={75}
      classNames={{
        container: "plasmo-gap-3",
        elementContainer: "plasmo-p-0 plasmo-m-0"
      }}
    />
  )
}
