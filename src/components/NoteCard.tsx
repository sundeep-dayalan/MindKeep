import type { Note } from "~services/db-service"

interface NoteCardProps {
  note: Note
  onEdit: (note: Note) => void
  onDelete: (id: string) => void
}

export function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  return (
    <div className="plasmo-bg-white plasmo-p-3 plasmo-rounded-lg plasmo-border plasmo-border-slate-200 hover:plasmo-border-blue-300 plasmo-transition-colors">
      <div className="plasmo-flex plasmo-items-start plasmo-justify-between plasmo-gap-2">
        <div className="plasmo-flex-1 plasmo-min-w-0">
          <h3 className="plasmo-font-medium plasmo-text-slate-900 plasmo-truncate">
            {note.title}
          </h3>
          <p className="plasmo-text-sm plasmo-text-slate-600 plasmo-mt-1 plasmo-line-clamp-2">
            {note.contentPlaintext}
          </p>
          <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-mt-2">
            <span className="plasmo-text-xs plasmo-px-2 plasmo-py-1 plasmo-bg-blue-100 plasmo-text-blue-700 plasmo-rounded">
              {note.category}
            </span>
            <span className="plasmo-text-xs plasmo-text-slate-400">
              {new Date(note.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="plasmo-flex plasmo-gap-1">
          <button
            onClick={() => onEdit(note)}
            className="plasmo-p-1 plasmo-text-blue-600 hover:plasmo-bg-blue-50 plasmo-rounded"
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
            onClick={() => onDelete(note.id)}
            className="plasmo-p-1 plasmo-text-red-600 hover:plasmo-bg-red-50 plasmo-rounded"
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
      </div>
    </div>
  )
}
