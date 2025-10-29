import { useEffect, useState } from "react"

import {
  getActivePersona,
  getAllPersonas,
  setActivePersona
} from "~services/db-service"
import { getSelectedPersonaId } from "~services/persona-settings"
import type { Persona } from "~types/persona"
import {
  isExtensionContextValid,
  safeAddStorageListener,
  safeExtensionCall,
  showExtensionReloadMessage
} from "~util/extension-context"
import { logger } from "~utils/logger"

interface PersonaSelectorProps {
  onPersonaChange?: (persona: Persona | null, isManualChange?: boolean) => void
  onInitializationChange?: (isInitializing: boolean) => void
  onManageClick?: () => void
  openUpward?: boolean
}

export function PersonaSelector({
  onPersonaChange,
  onInitializationChange,
  onManageClick,
  openUpward = true
}: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [activePersona, setActivePersonaState] = useState<Persona | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    logger.log("[PersonaSelector] Component mounted, loading personas")
    logger.log(
      "[PersonaSelector] onPersonaChange callback exists?",
      !!onPersonaChange
    )
    logger.log("[PersonaSelector] Callback type:", typeof onPersonaChange)
    loadPersonas()
  }, [])

  useEffect(() => {
    const handleStorageChange = async (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "local" && changes["mindkeep_persona_settings"]) {
        const newSettings = changes["mindkeep_persona_settings"].newValue
        const oldSettings = changes["mindkeep_persona_settings"].oldValue

        logger.log(" [PersonaSelector] Persona settings changed:", {
          old: oldSettings,
          new: newSettings
        })

        if (newSettings?.selectedPersonaId !== oldSettings?.selectedPersonaId) {
          logger.log(
            " [PersonaSelector] Selected persona changed to:",
            newSettings?.selectedPersonaId
          )

          if (newSettings?.selectedPersonaId) {
            const allPersonas = await getAllPersonas()
            const persona = allPersonas.find(
              (p) => p.id === newSettings.selectedPersonaId
            )
            if (persona) {
              logger.log(
                " [PersonaSelector] Syncing to persona from storage:",
                persona.name
              )
              setActivePersonaState(persona)

              if (onPersonaChange) {
                logger.log(
                  " [PersonaSelector] Notifying parent of synced persona"
                )
                onPersonaChange(persona, false)
              }
            }
          } else {
            logger.log(
              " [PersonaSelector] Syncing to default mode from storage"
            )
            setActivePersonaState(null)

            if (onPersonaChange) {
              logger.log(" [PersonaSelector] Notifying parent of default mode")
              onPersonaChange(null, false)
            }
          }
        }
      }
    }

    const cleanup = safeAddStorageListener(handleStorageChange)

    return () => {
      if (cleanup) {
        cleanup()
      }
    }
  }, [onPersonaChange])

  const loadPersonas = async () => {
    logger.log(" [PersonaSelector] loadPersonas called")

    if (!isExtensionContextValid()) {
      logger.error(
        " [PersonaSelector] Extension context is invalid - cannot load personas"
      )
      showExtensionReloadMessage()
      setIsInitializing(false)
      if (onInitializationChange) {
        onInitializationChange(false)
      }
      return
    }

    try {
      setIsInitializing(true)
      if (onInitializationChange) {
        onInitializationChange(true)
      }

      const isContentScript =
        typeof window !== "undefined" &&
        (window.location.protocol === "http:" ||
          window.location.protocol === "https:")

      let allPersonas: Persona[]
      let active: Persona | null

      if (isContentScript) {
        logger.log(
          " [PersonaSelector] Running in content script, fetching via messaging"
        )

        const personasResponse = await safeExtensionCall(
          () => chrome.runtime.sendMessage({ type: "GET_ALL_PERSONAS" }),
          { personas: [] }
        )
        const activeResponse = await safeExtensionCall(
          () => chrome.runtime.sendMessage({ type: "GET_ACTIVE_PERSONA" }),
          { persona: null }
        )

        allPersonas = personasResponse?.personas || []
        active = activeResponse?.persona || null
      } else {
        logger.log(
          " [PersonaSelector] Running in extension page, using direct DB access"
        )
        const [personas, activePersona] = await Promise.all([
          getAllPersonas(),
          getActivePersona()
        ])
        allPersonas = personas
        active = activePersona
      }

      logger.log(` [PersonaSelector] Loaded ${allPersonas.length} personas`)
      logger.log(" [PersonaSelector] Active persona:", active?.name || "None")

      const sortedPersonas = allPersonas.sort(
        (a, b) => b.createdAt - a.createdAt
      )

      setPersonas(sortedPersonas)
      setActivePersonaState(active)

      if (isInitializing) {
        logger.log(" [PersonaSelector] First load - restoring saved persona")
        await restoreSavedPersona(allPersonas)
      }
    } catch (error) {
      logger.error(" [PersonaSelector] Error loading personas:", error)
    } finally {
      setIsInitializing(false)
      if (onInitializationChange) {
        onInitializationChange(false)
      }
      logger.log(" [PersonaSelector] Initialization complete")
    }
  }

  const restoreSavedPersona = async (allPersonas: Persona[]) => {
    try {
      logger.log("[PersonaSelector] restoreSavedPersona called")
      const savedPersonaId = await getSelectedPersonaId()

      if (!savedPersonaId) {
        logger.log(
          "[PersonaSelector] No saved persona, staying in default mode"
        )
        return
      }

      logger.log(
        "[PersonaSelector] Restoring saved persona ID:",
        savedPersonaId
      )

      const savedPersona = allPersonas.find((p) => p.id === savedPersonaId)

      if (savedPersona) {
        logger.log("[PersonaSelector] Found saved persona:", savedPersona.name)

        setActivePersonaState(savedPersona)

        if (onPersonaChange) {
          logger.log(
            "[PersonaSelector] Calling onPersonaChange callback with restored persona"
          )
          logger.log("[PersonaSelector] Persona data:", {
            id: savedPersona.id,
            name: savedPersona.name,
            isManualChange: false
          })
          onPersonaChange(savedPersona, false)
          logger.log("[PersonaSelector] onPersonaChange callback completed")
        } else {
          logger.warn("[PersonaSelector] No onPersonaChange callback provided!")
        }
      } else {
        logger.log(
          "[PersonaSelector] Saved persona not found in database, clearing selection"
        )

        const { setSelectedPersona } = await import(
          "~services/persona-settings"
        )
        await setSelectedPersona(null)
      }
    } catch (error) {
      logger.error("[PersonaSelector] Error restoring saved persona:", error)
    }
  }

  const handleSelect = async (persona: Persona | null) => {
    logger.log(
      " [PersonaSelector] handleSelect for persona:",
      persona?.name || "None (default mode)"
    )

    if (!isExtensionContextValid()) {
      logger.error(
        " [PersonaSelector] Extension context is invalid - cannot change persona"
      )
      showExtensionReloadMessage()
      alert("Extension needs to be reloaded. Please refresh the page.")
      return
    }

    setLoading(true)
    setIsOpen(false)

    try {
      const isContentScript =
        typeof window !== "undefined" &&
        (window.location.protocol === "http:" ||
          window.location.protocol === "https:")

      if (isContentScript) {
        logger.log(
          " [PersonaSelector] Running in content script, using messaging to set active persona"
        )
        const response = await safeExtensionCall(
          () =>
            chrome.runtime.sendMessage({
              type: "SET_ACTIVE_PERSONA",
              data: { personaId: persona?.id || null }
            }),
          { success: false }
        )

        if (!response?.success) {
          throw new Error(response?.error || "Failed to set active persona")
        }
      } else {
        await setActivePersona(persona?.id || null)
      }

      setActivePersonaState(persona)

      if (onPersonaChange) {
        onPersonaChange(persona, true)
      }

      logger.log(" [PersonaSelector] Persona changed successfully")
    } catch (error) {
      logger.error(" [PersonaSelector] Error changing persona:", error)
      alert("Failed to change persona. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="plasmo-relative">
      {}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading || isInitializing}
        type="button"
        className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-px-2.5 plasmo-py-1.5 plasmo-rounded-lg plasmo-border plasmo-border-slate-100 plasmo-bg-slate-50 hover:plasmo-bg-slate-200 plasmo-transition-colors plasmo-min-w-[120px] disabled:plasmo-opacity-60 disabled:plasmo-cursor-not-allowed">
        {}
        {isInitializing ? (
          <>
            <svg
              className="plasmo-animate-spin plasmo-h-3 plasmo-w-3 plasmo-text-slate-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24">
              <circle
                className="plasmo-opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="plasmo-opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="plasmo-text-[13px] plasmo-font-medium plasmo-text-slate-500 plasmo-flex-1 plasmo-text-left">
              Loading...
            </span>
          </>
        ) : (
          <span className="plasmo-text-[13px] plasmo-font-medium plasmo-text-slate-700 plasmo-flex-1 plasmo-text-left plasmo-truncate">
            PERSONA | {activePersona?.name || "Default"}
          </span>
        )}

        {}
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

      {}
      {isOpen && (
        <>
          {}
          <div
            className="plasmo-fixed plasmo-inset-0 plasmo-z-[100]"
            onClick={() => setIsOpen(false)}
          />

          {}
          <div
            className={`plasmo-absolute plasmo-left-0 plasmo-w-[260px] plasmo-bg-white plasmo-border plasmo-border-slate-200 plasmo-rounded-lg plasmo-shadow-xl plasmo-z-[101] plasmo-max-h-[500px] plasmo-overflow-hidden plasmo-flex plasmo-flex-col ${
              openUpward
                ? "plasmo-bottom-full plasmo-mb-2"
                : "plasmo-top-full plasmo-mt-2"
            }`}>
            {}
            <div className="plasmo-px-3 plasmo-py-2.5 plasmo-border-b plasmo-border-slate-100 plasmo-bg-slate-50 plasmo-flex plasmo-items-center plasmo-justify-between">
              <h3 className="plasmo-text-xs plasmo-font-semibold plasmo-text-slate-700">
                Select Persona
              </h3>
              {onManageClick && (
                <button
                  onClick={() => {
                    setIsOpen(false)
                    onManageClick()
                  }}
                  type="button"
                  className="plasmo-flex plasmo-items-center plasmo-gap-1 plasmo-px-2 plasmo-py-1 plasmo-rounded plasmo-text-xs plasmo-text-slate-600 hover:plasmo-bg-slate-200 plasmo-transition-colors"
                  title="Manage Personas">
                  <svg
                    className="plasmo-w-3.5 plasmo-h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span className="plasmo-font-medium">Manage</span>
                </button>
              )}
            </div>

            {}
            <div
              className="plasmo-overflow-y-auto plasmo-flex-1 plasmo-max-h-[400px]"
              style={{ overflowY: "auto" }}>
              {}
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
                      MindKeepAI | Default
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
                    Full access to agentic tools
                  </p>
                </div>
              </button>

              {}
              {personas.length > 0 && (
                <div className="plasmo-h-px plasmo-bg-slate-100 plasmo-my-1" />
              )}

              {}
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
