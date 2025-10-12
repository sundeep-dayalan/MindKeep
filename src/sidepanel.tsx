import "~style.css"

function SidePanel() {
  const handleClose = () => {
    // Close the side panel by closing the window
    window.close()
  }

  return (
    <div className="plasmo-w-full plasmo-h-full plasmo-p-4 plasmo-bg-slate-50">
      <div className="plasmo-max-w-4xl plasmo-mx-auto">
        {/* Header with close button */}
        <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-mb-4">
          <h1 className="plasmo-text-2xl plasmo-font-bold plasmo-text-slate-900">
            MindKeep
          </h1>
          <button
            onClick={handleClose}
            className="plasmo-p-2 plasmo-rounded-lg plasmo-text-slate-500 hover:plasmo-text-slate-900 hover:plasmo-bg-slate-200 plasmo-transition-colors"
            title="Close side panel">
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

        <p className="plasmo-text-slate-600">
          Your personal AI-powered second brain 🧠
        </p>
        <div className="plasmo-mt-6">
          <p className="plasmo-text-sm plasmo-text-slate-500">
            Side panel is now working! Next steps: Add note management features.
          </p>
          <p className="plasmo-text-xs plasmo-text-slate-400 plasmo-mt-2">
            💡 Tip: Click the × button above or the extension icon to close
          </p>
        </div>
      </div>
    </div>
  )
}

export default SidePanel
