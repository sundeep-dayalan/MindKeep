interface HeaderProps {
  onClose: () => void
  onPersonasClick?: () => void
  view?: string
}

export function Header({ onClose, onPersonasClick, view }: HeaderProps) {
  return (
    <div className="plasmo-bg-white plasmo-border-b plasmo-border-slate-200 plasmo-p-4">
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
        <h1 className="plasmo-text-xl plasmo-font-bold plasmo-text-slate-900">
          MindKeep 🧠
        </h1>
        <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
          {onPersonasClick && (
            <button
              onClick={onPersonasClick}
              className={`plasmo-px-3 plasmo-py-1.5 plasmo-rounded-lg plasmo-text-sm plasmo-font-medium plasmo-transition-colors ${
                view === "personas"
                  ? "plasmo-bg-purple-600 plasmo-text-white"
                  : "plasmo-bg-slate-100 plasmo-text-slate-700 hover:plasmo-bg-slate-200"
              }`}
              title="Manage Personas">
              🎭 Personas
            </button>
          )}
          <button
            onClick={onClose}
            className="plasmo-p-2 plasmo-rounded-lg plasmo-text-slate-500 hover:plasmo-text-slate-900 hover:plasmo-bg-slate-100 plasmo-transition-colors"
            title="Close">
            <svg
              className="plasmo-w-5 plasmo-h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
