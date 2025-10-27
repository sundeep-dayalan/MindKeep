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
            <div className="plasmo-mt-3 plasmo-p-4 plasmo-bg-gradient-to-br plasmo-from-blue-50 plasmo-to-indigo-50 plasmo-border plasmo-border-blue-200 plasmo-rounded-lg plasmo-shadow-sm">
              <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-mb-3">
                <svg
                  className="plasmo-w-5 plasmo-h-5 plasmo-text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h4 className="plasmo-text-sm plasmo-font-semibold plasmo-text-blue-900">
                  Enable Chrome AI Features
                </h4>
              </div>

              <div className="plasmo-space-y-3 plasmo-text-xs plasmo-text-blue-800">
                <div className="plasmo-bg-white plasmo-rounded-md plasmo-p-3 plasmo-border plasmo-border-blue-100">
                  <p className="plasmo-font-medium plasmo-mb-2 plasmo-text-blue-900">
                    📋 Step 1: Enable Required Flags
                  </p>
                  <p className="plasmo-mb-2 plasmo-text-blue-700">
                    Copy and paste these URLs into your Chrome address bar:
                  </p>
                  <div className="plasmo-space-y-1.5">
                    <div className="plasmo-bg-blue-50 plasmo-p-2 plasmo-rounded plasmo-border plasmo-border-blue-200">
                      <code className="plasmo-text-xs plasmo-font-mono plasmo-text-blue-900">
                        chrome://flags/#optimization-guide-on-device-model
                      </code>
                      <p className="plasmo-text-[10px] plasmo-text-blue-600 plasmo-mt-1">
                        Set to "Enabled BypassPerfRequirement"
                      </p>
                    </div>
                    <div className="plasmo-bg-blue-50 plasmo-p-2 plasmo-rounded plasmo-border plasmo-border-blue-200">
                      <code className="plasmo-text-xs plasmo-font-mono plasmo-text-blue-900">
                        chrome://flags/#prompt-api-for-gemini-nano
                      </code>
                      <p className="plasmo-text-[10px] plasmo-text-blue-600 plasmo-mt-1">
                        Set to "Enabled"
                      </p>
                    </div>
                    <div className="plasmo-bg-blue-50 plasmo-p-2 plasmo-rounded plasmo-border plasmo-border-blue-200">
                      <code className="plasmo-text-xs plasmo-font-mono plasmo-text-blue-900">
                        chrome://flags/#summarization-api-for-gemini-nano
                      </code>
                      <p className="plasmo-text-[10px] plasmo-text-blue-600 plasmo-mt-1">
                        Set to "Enabled"
                      </p>
                    </div>
                  </div>
                </div>

                <div className="plasmo-bg-white plasmo-rounded-md plasmo-p-3 plasmo-border plasmo-border-blue-100">
                  <p className="plasmo-font-medium plasmo-mb-2 plasmo-text-blue-900">
                    🔄 Step 2: Restart Chrome
                  </p>
                  <p className="plasmo-text-blue-700">
                    After enabling flags, click "Relaunch" button in Chrome or
                    restart your browser completely.
                  </p>
                </div>

                <div className="plasmo-bg-white plasmo-rounded-md plasmo-p-3 plasmo-border plasmo-border-blue-100">
                  <p className="plasmo-font-medium plasmo-mb-2 plasmo-text-blue-900">
                    ⬇️ Step 3: Download AI Model
                  </p>
                  <p className="plasmo-text-blue-700 plasmo-mb-2">
                    After restart, Chrome will download the AI model
                    automatically. This may take a few minutes.
                  </p>
                  <button
                    onClick={handleCheckComponents}
                    className="plasmo-text-xs plasmo-px-2.5 plasmo-py-1.5 plasmo-bg-blue-100 plasmo-text-blue-800 plasmo-rounded plasmo-border plasmo-border-blue-200 hover:plasmo-bg-blue-200 plasmo-transition-colors plasmo-font-medium">
                    Check Download Status →
                  </button>
                  <p className="plasmo-text-[10px] plasmo-text-blue-600 plasmo-mt-2">
                    Look for "Optimization Guide On Device Model" component
                  </p>
                </div>

                <div className="plasmo-bg-amber-50 plasmo-rounded-md plasmo-p-3 plasmo-border plasmo-border-amber-200">
                  <p className="plasmo-font-medium plasmo-mb-1 plasmo-text-amber-900 plasmo-flex plasmo-items-center plasmo-gap-1.5">
                    <span>💡</span>
                    <span>Alternative: Use Chrome Dev/Canary</span>
                  </p>
                  <p className="plasmo-text-amber-800 plasmo-text-[11px]">
                    Chrome Dev and Canary have better AI support and may work
                    without additional configuration.
                  </p>
                </div>

                <div className="plasmo-bg-green-50 plasmo-rounded-md plasmo-p-2.5 plasmo-border plasmo-border-green-200">
                  <p className="plasmo-text-green-800 plasmo-text-[11px] plasmo-leading-relaxed">
                    <strong>Note:</strong> MindKeep works fine without AI - you
                    can manually write titles and summaries. AI features are
                    optional enhancements.
                  </p>
                </div>
              </div>
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
