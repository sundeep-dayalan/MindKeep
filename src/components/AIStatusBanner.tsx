import { useEffect, useState } from "react"

import {
  checkAllAIServices,
  type HealthCheckStatus
} from "~services/ai-service"

export function AIStatusBanner() {
  const [aiStatus, setAiStatus] = useState<HealthCheckStatus[]>(null)
  const [dismissed, setDismissed] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => {
    checkAllAIServices().then(setAiStatus)
  }, [])

  const recheckStatus = async () => {
    const status = await checkAllAIServices()
    setAiStatus(status)
    console.log("AI Status:", status)
  }

  if (
    !aiStatus ||
    dismissed ||
    aiStatus.every((service) => service.available)
  ) {
    return null
  }

  const handleEnableAI = () => {
    chrome.tabs.create({
      url: "chrome://flags/#optimization-guide-on-device-model"
    })
  }

  const handleCheckComponents = () => {
    chrome.tabs.create({ url: "chrome://components/" })
  }

  const handleDownloadChromeDev = () => {
    chrome.tabs.create({ url: "https://www.google.com/chrome/dev/" })
  }

  const handleViewDocumentation = () => {
    chrome.tabs.create({ url: "https://developer.chrome.com/docs/ai/built-in" })
  }

  return (
    <div className="plasmo-bg-yellow-50 plasmo-border plasmo-border-yellow-200 plasmo-rounded-lg plasmo-p-3 plasmo-mb-4">
      <div className="plasmo-flex plasmo-items-start plasmo-gap-3">
        <div className="plasmo-flex-shrink-0">
          <svg
            className="plasmo-w-5 plasmo-h-5 plasmo-text-yellow-600"
            fill="currentColor"
            viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="plasmo-flex-1 plasmo-min-w-0">
          <h3 className="plasmo-text-sm plasmo-font-medium plasmo-text-yellow-800">
            AI Features Not Available
          </h3>
          <p className="plasmo-text-xs plasmo-text-yellow-700 plasmo-mt-1">
            {aiStatus[0].message}
          </p>
          {aiStatus[0].status === "not-supported" && (
            <div className="plasmo-mt-2 plasmo-p-2 plasmo-bg-blue-50 plasmo-border plasmo-border-blue-200 plasmo-rounded plasmo-text-xs">
              <p className="plasmo-text-blue-900 plasmo-font-medium plasmo-mb-1">
                💡 Chrome AI may not be available on your platform yet
              </p>
              <p className="plasmo-text-blue-700">
                Try <strong>Chrome Dev</strong> or{" "}
                <strong>Chrome Canary</strong> which have better AI support.
                MindKeep will work fine without AI features - you'll just need
                to write titles and summaries manually.
                <pre className="plasmo-mt-2 plasmo-text-xs plasmo-text-blue-900 plasmo-bg-blue-100 plasmo-rounded plasmo-p-2 plasmo-overflow-x-auto">
                  {JSON.stringify(aiStatus, null, 2)}
                </pre>
              </p>
            </div>
          )}
          {showDebug && (
            <div className="plasmo-mt-2 plasmo-p-2 plasmo-bg-yellow-100 plasmo-rounded plasmo-text-xs plasmo-font-mono">
              <div>
                <strong>Status:</strong> {aiStatus[0].status}
              </div>
              <div>
                <strong>Available:</strong> {String(aiStatus[0].available)}
              </div>
              <div>
                <strong>Chrome AI API:</strong> {String("ai" in chrome)}
              </div>
              <div>
                <strong>Chrome Version:</strong>{" "}
                {navigator.userAgent.match(/Chrome\/(\d+)/)?.[1]}
              </div>
              <div>
                <strong>Platform:</strong> {navigator.platform}
              </div>
            </div>
          )}
          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2 plasmo-mt-2">
            <button
              onClick={recheckStatus}
              className="plasmo-text-xs plasmo-px-3 plasmo-py-1 plasmo-bg-blue-600 plasmo-text-white plasmo-rounded hover:plasmo-bg-blue-700 plasmo-transition-colors">
              ↻ Recheck
            </button>
            {aiStatus[0].status === "not-supported" ? (
              <>
                <button
                  onClick={handleDownloadChromeDev}
                  className="plasmo-text-xs plasmo-px-3 plasmo-py-1 plasmo-bg-green-600 plasmo-text-white plasmo-rounded hover:plasmo-bg-green-700 plasmo-transition-colors">
                  Try Chrome Dev
                </button>
                <button
                  onClick={handleViewDocumentation}
                  className="plasmo-text-xs plasmo-px-3 plasmo-py-1 plasmo-bg-purple-600 plasmo-text-white plasmo-rounded hover:plasmo-bg-purple-700 plasmo-transition-colors">
                  View Docs
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleEnableAI}
                  className="plasmo-text-xs plasmo-px-3 plasmo-py-1 plasmo-bg-yellow-600 plasmo-text-white plasmo-rounded hover:plasmo-bg-yellow-700 plasmo-transition-colors">
                  Open Flags
                </button>
                <button
                  onClick={handleCheckComponents}
                  className="plasmo-text-xs plasmo-px-3 plasmo-py-1 plasmo-bg-purple-600 plasmo-text-white plasmo-rounded hover:plasmo-bg-purple-700 plasmo-transition-colors">
                  Check Download
                </button>
              </>
            )}
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="plasmo-text-xs plasmo-px-3 plasmo-py-1 plasmo-text-yellow-700 hover:plasmo-bg-yellow-100 plasmo-rounded plasmo-transition-colors">
              {showDebug ? "Hide" : "Show"} Debug
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="plasmo-text-xs plasmo-px-3 plasmo-py-1 plasmo-text-yellow-700 hover:plasmo-bg-yellow-100 plasmo-rounded plasmo-transition-colors">
              Dismiss
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="plasmo-flex-shrink-0 plasmo-text-yellow-600 hover:plasmo-text-yellow-800">
          <svg
            className="plasmo-w-4 plasmo-h-4"
            fill="currentColor"
            viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
