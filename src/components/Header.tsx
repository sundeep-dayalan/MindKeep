interface HeaderProps {
  onClose: () => void
}

export function Header({ onClose }: HeaderProps) {
  return (
    <div className="plasmo-bg-white plasmo-border-b plasmo-border-slate-200 plasmo-p-4">
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
        <h1 className="plasmo-text-xl plasmo-font-bold plasmo-text-slate-900">
          MindKeep 🧠
        </h1>
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
  )
}
