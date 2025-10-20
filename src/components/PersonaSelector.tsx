/**
 * PersonaSelector Component
 * 
 * Dropdown selector for choosing and managing active persona in AI chat
 */

import { useEffect, useState } from "react"

import type { Persona } from "~types/persona"

import { getAllPersonas, getActivePersona, setActivePersona } from "~services/db-service"

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
      console.log("🎭 [PersonaSelector] Active persona:", active?.name || "None")
      
      setPersonas(allPersonas)
      setActivePersonaState(active)
    } catch (error) {
      console.error("🎭 [PersonaSelector] Error loading personas:", error)
    }
  }

  const handleSelect = async (persona: Persona | null) => {
    console.log("🎭 [PersonaSelector] handleSelect for persona:", persona?.name || "None (default mode)")
    
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
    
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      // Reload if persona-related data changes
      if (changes["mindkeep_persona_settings"]) {
        console.log("🎭 [PersonaSelector] Persona settings changed in storage, reloading")
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
      {/* Compact Icon Button with Dropdown */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        title={activePersona ? `${activePersona.name} (Search-only)` : "Default Mode (Full access)"}
        className={`plasmo-flex plasmo-items-center plasmo-gap-1.5 plasmo-px-2.5 plasmo-py-1.5 plasmo-rounded-lg plasmo-border plasmo-transition-all plasmo-group ${
          activePersona
            ? "plasmo-bg-gradient-to-r plasmo-from-purple-50 plasmo-to-purple-100 plasmo-border-purple-300 hover:plasmo-from-purple-100 hover:plasmo-to-purple-150 plasmo-shadow-sm"
            : "plasmo-bg-white plasmo-border-slate-200 hover:plasmo-bg-slate-50 hover:plasmo-border-slate-300"
        } ${loading ? "plasmo-opacity-50 plasmo-cursor-not-allowed" : "plasmo-cursor-pointer"}`}>
        {/* Icon */}
        <span className="plasmo-text-base plasmo-leading-none">{activePersona?.emoji || "⚡"}</span>
        
        {/* Dropdown Arrow */}
        <svg
          className={`plasmo-w-3.5 plasmo-h-3.5 plasmo-transition-transform plasmo-duration-200 ${
            isOpen ? "plasmo-rotate-180" : ""
          } ${
            activePersona ? "plasmo-text-purple-600" : "plasmo-text-slate-500 group-hover:plasmo-text-slate-700"
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
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

          {/* Menu Panel - Opens UPWARD */}
          <div className="plasmo-absolute plasmo-bottom-full plasmo-mb-2 plasmo-left-0 plasmo-w-80 plasmo-bg-white plasmo-border plasmo-border-slate-200 plasmo-rounded-xl plasmo-shadow-xl plasmo-z-[101] plasmo-max-h-[32rem] plasmo-overflow-hidden plasmo-flex plasmo-flex-col">
            {/* Header */}
            <div className="plasmo-px-4 plasmo-py-3 plasmo-border-b plasmo-border-slate-100 plasmo-bg-gradient-to-r plasmo-from-slate-50 plasmo-to-white">
              <h3 className="plasmo-text-sm plasmo-font-semibold plasmo-text-slate-800 plasmo-flex plasmo-items-center plasmo-gap-2">
                <span>🎭</span>
                <span>Select AI Persona</span>
              </h3>
              <p className="plasmo-text-xs plasmo-text-slate-500 plasmo-mt-0.5">
                Choose how the AI should respond
              </p>
            </div>

            {/* Scrollable Content */}
            <div className="plasmo-overflow-y-auto plasmo-max-h-96">
              {/* Default Mode Option */}
              <button
                onClick={() => handleSelect(null)}
                className={`plasmo-w-full plasmo-flex plasmo-items-start plasmo-gap-3 plasmo-px-4 plasmo-py-3 plasmo-transition-all plasmo-border-b plasmo-border-slate-100 ${
                  !activePersona 
                    ? "plasmo-bg-gradient-to-r plasmo-from-blue-50 plasmo-to-indigo-50 plasmo-border-l-4 plasmo-border-l-blue-500" 
                    : "hover:plasmo-bg-slate-50 plasmo-border-l-4 plasmo-border-l-transparent hover:plasmo-border-l-slate-300"
                }`}>
                <div className="plasmo-flex-shrink-0 plasmo-w-10 plasmo-h-10 plasmo-bg-gradient-to-br plasmo-from-blue-500 plasmo-to-indigo-600 plasmo-rounded-lg plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-xl plasmo-shadow-md">
                  ⚡
                </div>
                <div className="plasmo-flex-1 plasmo-text-left plasmo-min-w-0">
                  <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-mb-1">
                    <span className="plasmo-font-semibold plasmo-text-sm plasmo-text-slate-800">
                      Default Mode
                    </span>
                    {!activePersona && (
                      <svg className="plasmo-w-4 plasmo-h-4 plasmo-text-blue-600 plasmo-flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <p className="plasmo-text-xs plasmo-text-slate-600 plasmo-leading-relaxed">
                    Full access to create, update, and delete notes
                  </p>
                </div>
              </button>

              {/* Personas Section */}
              {personas.length > 0 && (
                <div className="plasmo-px-4 plasmo-py-2 plasmo-bg-slate-50 plasmo-border-b plasmo-border-slate-100">
                  <span className="plasmo-text-xs plasmo-font-medium plasmo-text-slate-500 plasmo-uppercase plasmo-tracking-wider">
                    Available Personas ({personas.length})
                  </span>
                </div>
              )}

              {/* Persona Options */}
              {personas.length === 0 ? (
                <div className="plasmo-px-4 plasmo-py-8 plasmo-text-center">
                  <div className="plasmo-w-16 plasmo-h-16 plasmo-mx-auto plasmo-bg-slate-100 plasmo-rounded-full plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-3xl plasmo-mb-3">
                    🎭
                  </div>
                  <p className="plasmo-text-sm plasmo-text-slate-600 plasmo-font-medium plasmo-mb-1">
                    No personas yet
                  </p>
                  <p className="plasmo-text-xs plasmo-text-slate-500">
                    Create personas in the Personas tab to customize AI behavior
                  </p>
                </div>
              ) : (
                personas.map((persona, idx) => (
                  <button
                    key={persona.id}
                    onClick={() => handleSelect(persona)}
                    className={`plasmo-w-full plasmo-flex plasmo-items-start plasmo-gap-3 plasmo-px-4 plasmo-py-3 plasmo-transition-all ${
                      idx < personas.length - 1 ? "plasmo-border-b plasmo-border-slate-100" : ""
                    } ${
                      activePersona?.id === persona.id
                        ? "plasmo-bg-gradient-to-r plasmo-from-purple-50 plasmo-to-pink-50 plasmo-border-l-4 plasmo-border-l-purple-500"
                        : "hover:plasmo-bg-slate-50 plasmo-border-l-4 plasmo-border-l-transparent hover:plasmo-border-l-slate-300"
                    }`}>
                    <div className="plasmo-flex-shrink-0 plasmo-w-10 plasmo-h-10 plasmo-bg-gradient-to-br plasmo-from-purple-500 plasmo-to-pink-600 plasmo-rounded-lg plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-xl plasmo-shadow-md">
                      {persona.emoji || "🤖"}
                    </div>
                    <div className="plasmo-flex-1 plasmo-text-left plasmo-min-w-0">
                      <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-mb-1">
                        <span className="plasmo-font-semibold plasmo-text-sm plasmo-text-slate-800 plasmo-truncate">
                          {persona.name}
                        </span>
                        {activePersona?.id === persona.id && (
                          <svg className="plasmo-w-4 plasmo-h-4 plasmo-text-purple-600 plasmo-flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <p className="plasmo-text-xs plasmo-text-slate-600 plasmo-line-clamp-2 plasmo-leading-relaxed">
                        {persona.description}
                      </p>
                      <div className="plasmo-flex plasmo-items-center plasmo-gap-1 plasmo-mt-1.5">
                        <svg className="plasmo-w-3 plasmo-h-3 plasmo-text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span className="plasmo-text-[10px] plasmo-text-slate-500 plasmo-uppercase plasmo-tracking-wide">
                          Search-only access
                        </span>
                      </div>
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
