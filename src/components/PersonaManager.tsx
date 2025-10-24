/**
 * PersonaManager Component
 *
 * Manages user personas - create, edit, delete, and activate personas
 */

import { useEffect, useState } from "react"

import {
  addPersona,
  deletePersona,
  getAllPersonas,
  setActivePersona,
  updatePersona
} from "~services/db-service"
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

  // Form state
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
      setPersonas(allPersonas)
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

        // If this was the active persona, notify parent
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
    console.log(" [PersonaManager] handleCancel - closing form")
    setIsCreating(false)
    setEditingPersona(null)
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
            <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-2">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Email Writer"
              className="plasmo-w-full plasmo-px-4 plasmo-py-2.5 plasmo-bg-gray-50 plasmo-border plasmo-border-gray-200 plasmo-rounded-lg focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-purple-500 focus:plasmo-border-transparent plasmo-text-sm plasmo-text-gray-900"
            />
          </div>

          <div>
            <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-2">
              Description *
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Brief description of what this persona does"
              className="plasmo-w-full plasmo-px-4 plasmo-py-2.5 plasmo-bg-gray-50 plasmo-border plasmo-border-gray-200 plasmo-rounded-lg focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-purple-500 focus:plasmo-border-transparent plasmo-text-sm plasmo-text-gray-900"
            />
          </div>

          <div>
            <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-2">
              Context / Instructions *
            </label>
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
            <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-2">
              Output Template (Optional)
            </label>
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
