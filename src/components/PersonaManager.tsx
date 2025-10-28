

import { useEffect, useState } from "react"

import {
  addPersona,
  deletePersona,
  getAllPersonas,
  setActivePersona,
  updatePersona
} from "~services/db-service"
import { executePrompt } from "~services/gemini-nano-service"
import type { Persona, PersonaInput } from "~types/persona"

interface PersonaManagerProps {
  onPersonaActivated?: (persona: Persona | null) => void
  onBack?: () => void
}

export function PersonaManager({
  onPersonaActivated,
  onBack
}: PersonaManagerProps) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null)
  const [loading, setLoading] = useState(false)

  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false)
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
  const [isGeneratingContext, setIsGeneratingContext] = useState(false)

  const LIMITS = {
    name: 25,
    description: 200,
    context: 8000,
    outputTemplate: 2000
  }

  const [formData, setFormData] = useState<PersonaInput>({
    name: "",
    description: "",
    context: "",
    outputTemplate: ""
  })

  useEffect(() => {
    console.log(" [PersonaManager] Component mounted, loading personas")
    loadPersonas()
  }, [])

  const loadPersonas = async () => {
    console.log(" [PersonaManager] loadPersonas called")
    setLoading(true)
    try {
      const allPersonas = await getAllPersonas()
      console.log(` [PersonaManager] Loaded ${allPersonas.length} personas`)

      const sortedPersonas = allPersonas.sort(
        (a, b) => b.createdAt - a.createdAt
      )

      setPersonas(sortedPersonas)
    } catch (error) {
      console.error(" [PersonaManager] Error loading personas:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    console.log(" [PersonaManager] handleCreate - opening create form")
    setFormData({
      name: "",
      description: "",
      context: "",
      outputTemplate: ""
    })
    setIsCreating(true)
    setEditingPersona(null)
  }

  const handleEdit = (persona: Persona) => {
    console.log(" [PersonaManager] handleEdit for persona:", persona.name)
    setFormData({
      name: persona.name,
      description: persona.description,
      context: persona.context,
      outputTemplate: persona.outputTemplate || ""
    })
    setEditingPersona(persona)
    setIsCreating(true)
  }

  const handleSave = async () => {
    console.log(" [PersonaManager] handleSave called with data:", formData)

    if (!formData.name.trim()) {
      alert("Please enter a persona name")
      return
    }
    if (!formData.description.trim()) {
      alert("Please enter a description")
      return
    }
    if (!formData.context.trim()) {
      alert("Please enter persona context/instructions")
      return
    }

    if (formData.name.length > LIMITS.name) {
      alert(`Name is too long. Maximum ${LIMITS.name} characters allowed.`)
      return
    }
    if (formData.description.length > LIMITS.description) {
      alert(
        `Description is too long. Maximum ${LIMITS.description} characters allowed.`
      )
      return
    }
    if (formData.context.length > LIMITS.context) {
      alert(
        `Context is too long. Maximum ${LIMITS.context} characters (~2000 tokens) allowed.`
      )
      return
    }
    if (
      formData.outputTemplate &&
      formData.outputTemplate.length > LIMITS.outputTemplate
    ) {
      alert(
        `Output template is too long. Maximum ${LIMITS.outputTemplate} characters (~500 tokens) allowed.`
      )
      return
    }

    setLoading(true)
    try {
      if (editingPersona) {
        console.log(
          " [PersonaManager] Updating existing persona:",
          editingPersona.id
        )
        await updatePersona(editingPersona.id, formData)
      } else {
        console.log(" [PersonaManager] Creating new persona")
        await addPersona(formData)
      }

      await loadPersonas()
      setIsCreating(false)
      setEditingPersona(null)
      console.log(" [PersonaManager] Persona saved successfully")
    } catch (error) {
      console.error(" [PersonaManager] Error saving persona:", error)
      alert("Failed to save persona. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (persona: Persona) => {
    console.log(" [PersonaManager] handleDelete for persona:", persona.name)

    if (persona.isDefault) {
      alert("Cannot delete default personas")
      return
    }

    if (!confirm(`Are you sure you want to delete "${persona.name}"?`)) {
      return
    }

    setLoading(true)
    try {
      const success = await deletePersona(persona.id)
      if (success) {
        console.log(" [PersonaManager] Persona deleted successfully")
        await loadPersonas()

        if (persona.isActive && onPersonaActivated) {
          onPersonaActivated(null)
        }
      } else {
        alert("Failed to delete persona")
      }
    } catch (error) {
      console.error(" [PersonaManager] Error deleting persona:", error)
      alert("Failed to delete persona. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async (persona: Persona | null) => {
    const personaId = persona?.id || null
    console.log(" [PersonaManager] handleActivate for persona ID:", personaId)

    setLoading(true)
    try {
      await setActivePersona(personaId)
      await loadPersonas()

      if (onPersonaActivated) {
        onPersonaActivated(persona)
      }

      console.log(
        " [PersonaManager] Persona activated:",
        persona?.name || "None (default mode)"
      )
    } catch (error) {
      console.error(" [PersonaManager] Error activating persona:", error)
      alert("Failed to activate persona. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    console.log("[PersonaManager] handleCancel - closing form")
    setIsCreating(false)
    setEditingPersona(null)
  }

  const handleGenerateTitle = async () => {
    console.log("🤖 [PersonaManager] handleGenerateTitle called")

    if (!formData.context.trim() && !formData.description.trim()) {
      alert(
        "Please enter either Context/Instructions or Description first to generate a title"
      )
      return
    }

    const startTime = performance.now()
    setIsGeneratingTitle(true)

    try {

      const inputSource = formData.context.trim() || formData.description.trim()

      const truncatedInput =
        inputSource.length > 500
          ? inputSource.substring(0, 500) + "..."
          : inputSource

      const prompt = `Generate a short persona name (2-4 words) for this AI assistant:

${truncatedInput}

Return only the name. Examples: "Email Writer", "Movie Critic", "Code Helper"`

      console.log("🤖 [PersonaManager] Generating title with prompt:", prompt)
      const generatedTitle = await executePrompt(prompt)

      const cleanTitle = generatedTitle.trim().replace(/^["']|["']$/g, "")
      // Use functional update to avoid overwriting other concurrent generations
      setFormData((prev) => ({ ...prev, name: cleanTitle }))

      const totalTime = performance.now() - startTime
      console.log(
        `⏱️ [PersonaManager] Title generation completed: ${totalTime.toFixed(2)}ms`
      )
    } catch (error) {
      const totalTime = performance.now() - startTime
      console.error(
        `❌ [PersonaManager] Title generation failed after ${totalTime.toFixed(2)}ms:`,
        error
      )
      const errorMessage = error.message || "Failed to generate title"
      if (
        confirm(
          errorMessage +
            "\n\nWould you like to open Chrome flags to enable AI features?"
        )
      ) {
        chrome.tabs.create({
          url: "chrome://flags/#optimization-guide-on-device-model"
        })
      }
    } finally {
      setIsGeneratingTitle(false)
    }
  }

  const handleGenerateDescription = async () => {
    console.log("🤖 [PersonaManager] handleGenerateDescription called")

    // Check if we have any input to work with
    if (!formData.context.trim() && !formData.name.trim()) {
      alert(
        "Please enter either Context/Instructions or Name first to generate a description"
      )
      return
    }

    const startTime = performance.now()
    setIsGeneratingDescription(true)

    try {
      // Build prompt based on available input
      const inputSource = formData.context.trim() || formData.name.trim()

      // Limit input length to avoid token overflow
      const truncatedInput =
        inputSource.length > 500
          ? inputSource.substring(0, 500) + "..."
          : inputSource

      const prompt = `Generate a one-sentence description (15-25 words) for this AI persona:

${truncatedInput}

Return only the description sentence.`

      console.log(
        "🤖 [PersonaManager] Generating description with prompt:",
        prompt
      )
      const generatedDescription = await executePrompt(prompt)

      // Clean up the response
      const cleanDescription = generatedDescription.trim()
      // Use functional update to avoid overwriting other concurrent generations
      setFormData((prev) => ({ ...prev, description: cleanDescription }))

      const totalTime = performance.now() - startTime
      console.log(
        `⏱️ [PersonaManager] Description generation completed: ${totalTime.toFixed(2)}ms`
      )
    } catch (error) {
      const totalTime = performance.now() - startTime
      console.error(
        `❌ [PersonaManager] Description generation failed after ${totalTime.toFixed(2)}ms:`,
        error
      )
      const errorMessage = error.message || "Failed to generate description"
      if (
        confirm(
          errorMessage +
            "\n\nWould you like to open Chrome flags to enable AI features?"
        )
      ) {
        chrome.tabs.create({
          url: "chrome://flags/#optimization-guide-on-device-model"
        })
      }
    } finally {
      setIsGeneratingDescription(false)
    }
  }

  const handleGenerateContext = async () => {
    console.log("🤖 [PersonaManager] handleGenerateContext called")

    // Check if we have any input to work with
    if (
      !formData.context.trim() &&
      !formData.name.trim() &&
      !formData.description.trim()
    ) {
      alert(
        "Please enter at least one field (Name, Description, or basic Context) to generate detailed instructions"
      )
      return
    }

    const startTime = performance.now()
    setIsGeneratingContext(true)

    try {
      // Build prompt based on available input
      let inputSource = ""
      if (formData.context.trim()) {
        // User has basic context - expand it
        inputSource = `Basic Context: ${formData.context.trim()}`
      } else {
        // Use title and/or description
        if (formData.name.trim())
          inputSource += `Name: ${formData.name.trim()}\n`
        if (formData.description.trim())
          inputSource += `Description: ${formData.description.trim()}`
      }

      const prompt = `Create detailed AI persona instructions based on this:

${inputSource}

Write 3-5 concise paragraphs covering:
1. Role and purpose
2. Key behaviors (tone, style, response format)
3. Guidelines (do's and don'ts)

Keep it focused and actionable. No markdown headers, just clear paragraphs.`

      console.log("🤖 [PersonaManager] Generating context with prompt:", prompt)
      const generatedContext = await executePrompt(prompt)

      // Clean up the response
      const cleanContext = generatedContext.trim()
      // Use functional update to avoid overwriting other concurrent generations
      setFormData((prev) => ({ ...prev, context: cleanContext }))

      const totalTime = performance.now() - startTime
      console.log(
        `⏱️ [PersonaManager] Context generation completed: ${totalTime.toFixed(2)}ms`
      )
    } catch (error) {
      const totalTime = performance.now() - startTime
      console.error(
        `❌ [PersonaManager] Context generation failed after ${totalTime.toFixed(2)}ms:`,
        error
      )
      const errorMessage =
        error.message || "Failed to generate context instructions"
      if (
        confirm(
          errorMessage +
            "\n\nWould you like to open Chrome flags to enable AI features?"
        )
      ) {
        chrome.tabs.create({
          url: "chrome://flags/#optimization-guide-on-device-model"
        })
      }
    } finally {
      setIsGeneratingContext(false)
    }
  }

  const activePersona = personas.find((p) => p.isActive)

  if (isCreating) {
    return (
      <div className="plasmo-flex plasmo-flex-col plasmo-h-full plasmo-bg-gray-50">
        <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-p-6 plasmo-border-b plasmo-border-gray-200 plasmo-flex-shrink-0 plasmo-bg-white">
          <h2 className="plasmo-text-xl plasmo-font-semibold plasmo-text-gray-900">
            {editingPersona ? "Edit Persona" : "Create New Persona"}
          </h2>
          <button
            onClick={handleCancel}
            className="plasmo-text-gray-400 hover:plasmo-text-gray-600 plasmo-transition-colors">
            ✕
          </button>
        </div>

        <div className="plasmo-flex-1 plasmo-overflow-y-auto plasmo-p-6 plasmo-space-y-5 plasmo-bg-white">
          <div>
            <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-mb-2">
              <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700">
                Name *
              </label>
              <span
                className={`plasmo-text-xs ${
                  formData.name.length > LIMITS.name
                    ? "plasmo-text-red-600 plasmo-font-semibold"
                    : "plasmo-text-gray-500"
                }`}>
                {formData.name.length}/{LIMITS.name}
              </span>
            </div>
            <div className="plasmo-relative">
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                maxLength={LIMITS.name}
                placeholder="e.g., Email Writer"
                className="plasmo-w-full plasmo-px-4 plasmo-py-2.5 plasmo-pr-12 plasmo-bg-gray-50 plasmo-border plasmo-border-gray-200 plasmo-rounded-lg focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-purple-500 focus:plasmo-border-transparent plasmo-text-sm plasmo-text-gray-900"
              />
              <button
                onClick={handleGenerateTitle}
                disabled={
                  isGeneratingTitle ||
                  isGeneratingDescription ||
                  isGeneratingContext
                }
                className="plasmo-absolute plasmo-right-3 plasmo-top-1/2 plasmo--translate-y-1/2 plasmo-p-2 plasmo-text-purple-600 hover:plasmo-bg-purple-50 plasmo-rounded-lg disabled:plasmo-opacity-40 disabled:plasmo-cursor-not-allowed plasmo-transition-all"
                title={
                  isGeneratingTitle
                    ? "Generating title..."
                    : "Generate title using AI (1-2 seconds)"
                }>
                {isGeneratingTitle ? (
                  <svg
                    className="plasmo-w-5 plasmo-h-5 plasmo-animate-spin"
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
                ) : (
                  <svg
                    className="plasmo-w-5 plasmo-h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-mb-2">
              <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700">
                Description *
              </label>
              <span
                className={`plasmo-text-xs ${
                  formData.description.length > LIMITS.description
                    ? "plasmo-text-red-600 plasmo-font-semibold"
                    : "plasmo-text-gray-500"
                }`}>
                {formData.description.length}/{LIMITS.description}
              </span>
            </div>
            <div className="plasmo-relative">
              <input
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                maxLength={LIMITS.description}
                placeholder="Brief description of what this persona does"
                className="plasmo-w-full plasmo-px-4 plasmo-py-2.5 plasmo-pr-12 plasmo-bg-gray-50 plasmo-border plasmo-border-gray-200 plasmo-rounded-lg focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-purple-500 focus:plasmo-border-transparent plasmo-text-sm plasmo-text-gray-900"
              />
              <button
                onClick={handleGenerateDescription}
                disabled={
                  isGeneratingDescription ||
                  isGeneratingTitle ||
                  isGeneratingContext
                }
                className="plasmo-absolute plasmo-right-3 plasmo-top-1/2 plasmo--translate-y-1/2 plasmo-p-2 plasmo-text-purple-600 hover:plasmo-bg-purple-50 plasmo-rounded-lg disabled:plasmo-opacity-40 disabled:plasmo-cursor-not-allowed plasmo-transition-all"
                title={
                  isGeneratingDescription
                    ? "Generating description..."
                    : "Generate description using AI (1-2 seconds)"
                }>
                {isGeneratingDescription ? (
                  <svg
                    className="plasmo-w-5 plasmo-h-5 plasmo-animate-spin"
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
                ) : (
                  <svg
                    className="plasmo-w-5 plasmo-h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-mb-2">
              <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
                <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700">
                  Context / Instructions *
                </label>
                <span
                  className={`plasmo-text-xs ${
                    formData.context.length > LIMITS.context
                      ? "plasmo-text-red-600 plasmo-font-semibold"
                      : "plasmo-text-gray-500"
                  }`}>
                  {formData.context.length}/{LIMITS.context}
                </span>
              </div>
              <button
                onClick={handleGenerateContext}
                disabled={
                  isGeneratingContext ||
                  isGeneratingTitle ||
                  isGeneratingDescription
                }
                className="plasmo-flex plasmo-items-center plasmo-gap-1.5 plasmo-px-3 plasmo-py-1.5 plasmo-text-xs plasmo-font-medium plasmo-text-purple-600 hover:plasmo-bg-purple-50 plasmo-rounded-md disabled:plasmo-opacity-40 disabled:plasmo-cursor-not-allowed plasmo-transition-all"
                title={
                  isGeneratingContext
                    ? "Generating detailed instructions... This may take 5-10 seconds"
                    : "Generate detailed instructions using AI"
                }>
                {isGeneratingContext ? (
                  <>
                    <svg
                      className="plasmo-w-4 plasmo-h-4 plasmo-animate-spin"
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
                    <span className="plasmo-animate-pulse">Generating...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="plasmo-w-4 plasmo-h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Generate with AI
                  </>
                )}
              </button>
            </div>
            <textarea
              value={formData.context}
              onChange={(e) =>
                setFormData({ ...formData, context: e.target.value })
              }
              placeholder="Detailed instructions for how this persona should behave and format responses..."
              rows={8}
              className="plasmo-w-full plasmo-px-4 plasmo-py-2.5 plasmo-bg-gray-50 plasmo-border plasmo-border-gray-200 plasmo-rounded-lg focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-purple-500 focus:plasmo-border-transparent plasmo-resize-none plasmo-text-sm plasmo-text-gray-900"
            />
          </div>

          <div>
            <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-mb-2">
              <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700">
                Output Template (Optional)
              </label>
              <span
                className={`plasmo-text-xs ${
                  formData.outputTemplate.length > LIMITS.outputTemplate
                    ? "plasmo-text-red-600 plasmo-font-semibold"
                    : "plasmo-text-gray-500"
                }`}>
                {formData.outputTemplate.length}/{LIMITS.outputTemplate}
              </span>
            </div>
            <textarea
              value={formData.outputTemplate}
              onChange={(e) =>
                setFormData({ ...formData, outputTemplate: e.target.value })
              }
              placeholder="Optional template for consistent formatting..."
              rows={4}
              className="plasmo-w-full plasmo-px-4 plasmo-py-2.5 plasmo-bg-gray-50 plasmo-border plasmo-border-gray-200 plasmo-rounded-lg focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-purple-500 focus:plasmo-border-transparent plasmo-resize-none plasmo-text-sm plasmo-text-gray-900"
            />
          </div>
        </div>

        <div className="plasmo-flex plasmo-gap-3 plasmo-p-6 plasmo-border-t plasmo-border-gray-200 plasmo-flex-shrink-0 plasmo-bg-white">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="plasmo-flex-1 plasmo-px-4 plasmo-py-2.5 plasmo-border plasmo-border-gray-200 plasmo-rounded-lg hover:plasmo-bg-gray-50 plasmo-font-medium plasmo-text-sm plasmo-transition-colors plasmo-text-gray-700">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="plasmo-flex-1 plasmo-bg-purple-600 plasmo-text-white plasmo-px-4 plasmo-py-2.5 plasmo-rounded-lg hover:plasmo-bg-purple-700 disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed plasmo-font-medium plasmo-text-sm plasmo-transition-colors">
            {loading
              ? "Saving..."
              : editingPersona
                ? "Update Persona"
                : "Create Persona"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-h-full plasmo-bg-gray-50">
      <div className="plasmo-flex plasmo-items-center plasmo-gap-4 plasmo-p-4 plasmo-border-b plasmo-border-gray-200 plasmo-bg-white">
        {onBack && (
          <button
            onClick={onBack}
            className="plasmo-text-gray-600 hover:plasmo-text-gray-900 plasmo-transition-colors">
            <svg
              className="plasmo-w-5 plasmo-h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}
        <h2 className="plasmo-flex-1 plasmo-text-xl plasmo-font-semibold plasmo-text-gray-900">
          Manage Personas
        </h2>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="plasmo-bg-purple-600 plasmo-text-white plasmo-px-4 plasmo-py-2 plasmo-rounded-lg hover:plasmo-bg-purple-700 disabled:plasmo-opacity-50 plasmo-text-sm plasmo-font-medium plasmo-transition-colors">
          + New Persona
        </button>
      </div>

      {activePersona && (
        <div className="plasmo-mx-3 plasmo-mt-6 plasmo-p-4 plasmo-bg-purple-50 plasmo-border plasmo-border-purple-200 plasmo-rounded-xl">
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
            <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
              <div>
                <div className="plasmo-font-medium plasmo-text-gray-900">
                  {activePersona.name}
                </div>
                <div className="plasmo-text-xs plasmo-text-purple-600 plasmo-mt-0.5">
                  Currently Active
                </div>
              </div>
            </div>
            <button
              onClick={() => handleActivate(null)}
              className="plasmo-text-xs plasmo-px-3 plasmo-py-1.5 plasmo-border plasmo-border-purple-300 plasmo-rounded-md hover:plasmo-bg-purple-100 plasmo-text-purple-700 plasmo-font-medium plasmo-transition-colors">
              Deactivate
            </button>
          </div>
        </div>
      )}

      {!activePersona && (
        <div className="plasmo-mx-3 plasmo-mt-6 plasmo-p-4 plasmo-bg-gray-100 plasmo-border plasmo-border-gray-200 plasmo-rounded-xl plasmo-text-sm plasmo-text-gray-600">
          No persona active. You're in default mode with full tool access.
        </div>
      )}

      <div className="plasmo-flex-1 plasmo-overflow-y-auto plasmo-px-3 plasmo-py-6 plasmo-space-y-3 scrollbar-hide">
        {loading && personas.length === 0 ? (
          <div className="plasmo-text-center plasmo-text-gray-500 plasmo-py-12">
            Loading personas...
          </div>
        ) : personas.length === 0 ? (
          <div className="plasmo-text-center plasmo-text-gray-500 plasmo-py-12">
            No personas yet. Create your first persona to get started!
          </div>
        ) : (
          personas.map((persona) => (
            <div
              key={persona.id}
              className={`plasmo-p-3 plasmo-bg-white plasmo-border plasmo-rounded-xl plasmo-transition-all hover:plasmo-shadow-md ${
                persona.isActive
                  ? "plasmo-border-purple-300 plasmo-ring-1 plasmo-ring-purple-200"
                  : "plasmo-border-gray-200 hover:plasmo-border-purple-200"
              }`}>
              <div className="plasmo-flex plasmo-items-start plasmo-justify-between plasmo-gap-4">
                <div className="plasmo-flex plasmo-items-start plasmo-gap-3 plasmo-flex-1 plasmo-min-w-0">
                  <div className="plasmo-flex-1 plasmo-min-w-0">
                    <div className="plasmo-font-medium plasmo-text-gray-900 plasmo-text-base plasmo-mb-1">
                      {persona.name}
                    </div>
                    <div className="plasmo-text-sm plasmo-text-gray-600 plasmo-line-clamp-2 plasmo-mb-2">
                      {persona.description}
                    </div>
                    {persona.isDefault && (
                      <span className="plasmo-inline-block plasmo-text-xs plasmo-px-2 plasmo-py-1 plasmo-bg-purple-100 plasmo-text-purple-700 plasmo-rounded-md plasmo-font-medium">
                        Default Persona
                      </span>
                    )}
                  </div>
                </div>
                <div className="plasmo-flex plasmo-gap-2 plasmo-flex-shrink-0">
                  {!persona.isDefault && (
                    <button
                      onClick={() => handleDelete(persona)}
                      disabled={loading}
                      className="plasmo-text-xs plasmo-px-3 plasmo-py-1.5 plasmo-border plasmo-border-red-200 plasmo-rounded-md hover:plasmo-bg-red-50 plasmo-text-red-600 plasmo-font-medium plasmo-transition-colors">
                      Delete
                    </button>
                  )}
                  {!persona.isActive && (
                    <button
                      onClick={() => handleActivate(persona)}
                      disabled={loading}
                      className="plasmo-text-xs plasmo-px-3 plasmo-py-1.5 plasmo-bg-purple-600 plasmo-text-white plasmo-rounded-md hover:plasmo-bg-purple-700 disabled:plasmo-opacity-50 plasmo-whitespace-nowrap plasmo-font-medium plasmo-transition-colors">
                      Activate
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(persona)}
                    disabled={loading}
                    className="plasmo-text-xs plasmo-px-3 plasmo-py-1.5 plasmo-border plasmo-border-gray-200 plasmo-rounded-md hover:plasmo-bg-gray-50 plasmo-text-gray-700 plasmo-font-medium plasmo-transition-colors">
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
