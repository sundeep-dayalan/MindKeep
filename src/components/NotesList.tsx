import type { Note } from "~services/db-service"
import { NoteCard } from "./NoteCard"

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
      <div className="plasmo-text-center plasmo-py-8 plasmo-text-slate-500">
        Loading...
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="plasmo-text-center plasmo-py-8 plasmo-text-slate-500">
        No notes found. Create your first note!
      </div>
    )
  }

  return (
    <div className="plasmo-space-y-2">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
