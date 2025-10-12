import "~style.css"

function SidePanel() {
  return (
    <div className="plasmo-w-full plasmo-h-full plasmo-p-4 plasmo-bg-slate-50">
      <div className="plasmo-max-w-4xl plasmo-mx-auto">
        <h1 className="plasmo-text-2xl plasmo-font-bold plasmo-text-slate-900 plasmo-mb-4">
          MindKeep
        </h1>
        <p className="plasmo-text-slate-600">
          Your personal AI-powered second brain 🧠
        </p>
        <div className="plasmo-mt-6">
          <p className="plasmo-text-sm plasmo-text-slate-500">
            Side panel is now working! Next steps: Add note management features.
          </p>
        </div>
      </div>
    </div>
  )
}

export default SidePanel
