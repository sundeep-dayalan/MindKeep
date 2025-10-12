import "~style.css"

function IndexPopup() {
  const openSidePanel = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.sidePanel.open({ tabId: tabs[0].id })
      }
    })
  }

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-justify-center plasmo-p-4 plasmo-w-64">
      <h2 className="plasmo-text-lg plasmo-font-bold plasmo-text-slate-900 plasmo-mb-2">
        MindKeep
      </h2>
      <p className="plasmo-text-xs plasmo-text-slate-600 plasmo-text-center plasmo-mb-3">
        Your AI-powered second brain
      </p>
      <button
        onClick={openSidePanel}
        className="plasmo-px-4 plasmo-py-2 plasmo-bg-blue-500 hover:plasmo-bg-blue-600 plasmo-text-white plasmo-rounded-lg plasmo-text-sm plasmo-transition-colors">
        Open Side Panel
      </button>
    </div>
  )
}

export default IndexPopup
