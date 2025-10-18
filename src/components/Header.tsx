import { useEffect, useState } from "react"

import { getAgentSettings, setAgentSettings } from "~services/agent-pipeline"

interface HeaderProps {
  onClose: () => void
}

export function Header({ onClose }: HeaderProps) {
  const [agentsEnabled, setAgentsEnabled] = useState(true)

  // Load agent settings on mount
  useEffect(() => {
    getAgentSettings().then((settings) => {
      setAgentsEnabled(settings.enabled)
    })
  }, [])

  // Toggle agent system
  const toggleAgents = async () => {
    const newState = !agentsEnabled
    setAgentsEnabled(newState)

    const settings = await getAgentSettings()
    await setAgentSettings({
      ...settings,
      enabled: newState
    })
  }

  return (
    <div className="plasmo-bg-white plasmo-border-b plasmo-border-slate-200 plasmo-p-4">
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
        <h1 className="plasmo-text-xl plasmo-font-bold plasmo-text-slate-900">
          MindKeep 🧠
        </h1>
        <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
          {/* Agent Toggle */}
          <button
            onClick={toggleAgents}
            className={`plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-px-3 plasmo-py-1.5 plasmo-rounded-lg plasmo-text-sm plasmo-font-medium plasmo-transition-colors ${
              agentsEnabled
                ? "plasmo-bg-purple-100 plasmo-text-purple-700 hover:plasmo-bg-purple-200"
                : "plasmo-bg-slate-100 plasmo-text-slate-500 hover:plasmo-bg-slate-200"
            }`}
            title={agentsEnabled ? "Agents: ON" : "Agents: OFF"}>
            <span>🤖</span>
            <span>{agentsEnabled ? "ON" : "OFF"}</span>
          </button>

          {/* Close Button */}
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
