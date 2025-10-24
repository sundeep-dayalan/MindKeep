/**
 * PersonaSelector Component
 *
 * Dropdown selector for choosing and managing active persona in AI chat
 */

import { useEffect, useState } from "react"

import {
  getActivePersona,
  getAllPersonas,
  setActivePersona
} from "~services/db-service"
import type { Persona } from "~types/persona"

interface PersonaSelectorProps {
  onPersonaChange?: (persona: Persona | null) => void
}

export function PersonaSelector({ onPersonaChange }: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [activePersona, setActivePersonaState] = useState<Persona | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    console.log("🎭 [PersonaSelector] Component mounted, loading personas")
    loadPersonas()
  }, [])

  const loadPersonas = async () => {
    console.log("🎭 [PersonaSelector] loadPersonas called")
    try {
      const [allPersonas, active] = await Promise.all([
        getAllPersonas(),
        getActivePersona()
      ])

      console.log(`🎭 [PersonaSelector] Loaded ${allPersonas.length} personas`)
      console.log(
        "🎭 [PersonaSelector] Active persona:",
        active?.name || "None"
      )

      setPersonas(allPersonas)
      setActivePersonaState(active)
    } catch (error) {
      console.error("🎭 [PersonaSelector] Error loading personas:", error)
    }
  }

  const handleSelect = async (persona: Persona | null) => {
    console.log(
      "🎭 [PersonaSelector] handleSelect for persona:",
      persona?.name || "None (default mode)"
    )

    setLoading(true)
    setIsOpen(false)

    try {
      await setActivePersona(persona?.id || null)
      setActivePersonaState(persona)

      if (onPersonaChange) {
        onPersonaChange(persona)
      }

      console.log("🎭 [PersonaSelector] Persona changed successfully")
    } catch (error) {
      console.error("🎭 [PersonaSelector] Error changing persona:", error)
      alert("Failed to change persona. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Trigger reload when personas change in storage
  useEffect(() => {
    console.log("🎭 [PersonaSelector] Setting up storage listener")

    const handleStorageChange = (changes: {
      [key: string]: chrome.storage.StorageChange
    }) => {
      // Reload if persona-related data changes
      if (changes["mindkeep_persona_settings"]) {
        console.log(
          "🎭 [PersonaSelector] Persona settings changed in storage, reloading"
        )
        loadPersonas()
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      console.log("🎭 [PersonaSelector] Removing storage listener")
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  return (
    <div className="plasmo-relative">
      {/* Model Selector Style Dropdown Button - Exact Reference Match */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        type="button"
        className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-px-2.5 plasmo-py-1.5 plasmo-rounded-lg plasmo-border plasmo-border-slate-100 plasmo-bg-slate-50 hover:plasmo-bg-slate-200 plasmo-transition-colors plasmo-min-w-[120px]">
        {/* Name */}
        <span className="plasmo-text-[13px] plasmo-font-medium plasmo-text-slate-700 plasmo-flex-1 plasmo-text-left plasmo-truncate">
          {activePersona?.name || "Default"}
        </span>

        {/* Dropdown Arrow */}
        <svg
          className={`plasmo-w-3 plasmo-h-3 plasmo-transition-transform plasmo-duration-200 plasmo-text-slate-400 ${
            isOpen ? "plasmo-rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="plasmo-fixed plasmo-inset-0 plasmo-z-[100]"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Panel - Opens UPWARD - Compact Style */}
          <div className="plasmo-absolute plasmo-bottom-full plasmo-mb-2 plasmo-left-0 plasmo-w-[260px] plasmo-bg-white plasmo-border plasmo-border-slate-200 plasmo-rounded-lg plasmo-shadow-xl plasmo-z-[101] plasmo-max-h-[360px] plasmo-overflow-hidden plasmo-flex plasmo-flex-col">
            {/* Header */}
            <div className="plasmo-px-3 plasmo-py-2.5 plasmo-border-b plasmo-border-slate-100 plasmo-bg-slate-50">
              <h3 className="plasmo-text-xs plasmo-font-semibold plasmo-text-slate-700">
                Select Persona
              </h3>
            </div>

            {/* Scrollable Content */}
            <div className="plasmo-overflow-y-auto plasmo-flex-1 plasmo-no-visible-scrollbar">
              {/* Default Mode Option */}
              <button
                onClick={() => handleSelect(null)}
                type="button"
                className={`plasmo-w-full plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-px-3 plasmo-py-2 plasmo-transition-all plasmo-text-left ${
                  !activePersona
                    ? "plasmo-bg-slate-100"
                    : "hover:plasmo-bg-slate-50"
                }`}>
                <div className="plasmo-flex-1 plasmo-min-w-0">
                  <div className="plasmo-flex plasmo-items-center plasmo-gap-1.5">
                    <span className="plasmo-text-[13px] plasmo-font-medium plasmo-text-slate-800">
                      Default
                    </span>
                    {!activePersona && (
                      <svg
                        className="plasmo-w-3 plasmo-h-3 plasmo-text-blue-600 plasmo-flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <p className="plasmo-text-[11px] plasmo-text-slate-500 plasmo-truncate">
                    Full tool access
                  </p>
                </div>
              </button>

              {/* Divider */}
              {personas.length > 0 && (
                <div className="plasmo-h-px plasmo-bg-slate-100 plasmo-my-1" />
              )}

              {/* Persona Options */}
              {personas.length === 0 ? (
                <div className="plasmo-px-3 plasmo-py-4 plasmo-text-center">
                  <p className="plasmo-text-[11px] plasmo-text-slate-500">
                    No personas available
                  </p>
                </div>
              ) : (
                personas.map((persona) => (
                  <button
                    key={persona.id}
                    onClick={() => handleSelect(persona)}
                    type="button"
                    className={`plasmo-w-full plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-px-3 plasmo-py-2 plasmo-transition-all plasmo-text-left ${
                      activePersona?.id === persona.id
                        ? "plasmo-bg-slate-100"
                        : "hover:plasmo-bg-slate-50"
                    }`}>
                    <div className="plasmo-flex-1 plasmo-min-w-0">
                      <div className="plasmo-flex plasmo-items-center plasmo-gap-1.5">
                        <span className="plasmo-text-[13px] plasmo-font-medium plasmo-text-slate-800 plasmo-truncate">
                          {persona.name}
                        </span>
                        {activePersona?.id === persona.id && (
                          <svg
                            className="plasmo-w-3 plasmo-h-3 plasmo-text-blue-600 plasmo-flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <p className="plasmo-text-[11px] plasmo-text-slate-500 plasmo-truncate">
                        {persona.description.substring(0, 40)}
                        {persona.description.length > 40 ? "..." : ""}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
