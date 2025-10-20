/**
 * PersonaManager Component
 *  
 * Manages user personas - create, edit, delete, and activate personas
 */

import { useEffect, useState } from "react"

import type { Persona, PersonaInput } from "~types/persona"

import {
  addPersona,
  deletePersona,
  getAllPersonas,
  setActivePersona,
  updatePersona
} from "~services/db-service"

interface PersonaManagerProps {
  onPersonaActivated?: (persona: Persona | null) => void
}

export function PersonaManager({ onPersonaActivated }: PersonaManagerProps) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null)
  const [loading, setLoading] = useState(false)

  // Form state
  const [formData, setFormData] = useState<PersonaInput>({
    name: "",
    description: "",
    context: "",
    emoji: "🤖",
    outputTemplate: ""
  })

  useEffect(() => {
    console.log("🎭 [PersonaManager] Component mounted, loading personas")
    loadPersonas()
  }, [])

  const loadPersonas = async () => {
    console.log("🎭 [PersonaManager] loadPersonas called")
    setLoading(true)
    try {
      const allPersonas = await getAllPersonas()
      console.log(`🎭 [PersonaManager] Loaded ${allPersonas.length} personas`)
      setPersonas(allPersonas)
    } catch (error) {
      console.error("🎭 [PersonaManager] Error loading personas:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    console.log("🎭 [PersonaManager] handleCreate - opening create form")
    setFormData({
      name: "",
      description: "",
      context: "",
      emoji: "🤖",
      outputTemplate: ""
    })
    setIsCreating(true)
    setEditingPersona(null)
  }

  const handleEdit = (persona: Persona) => {
    console.log("🎭 [PersonaManager] handleEdit for persona:", persona.name)
    setFormData({
      name: persona.name,
      description: persona.description,
      context: persona.context,
      emoji: persona.emoji || "🤖",
      outputTemplate: persona.outputTemplate || ""
    })
    setEditingPersona(persona)
    setIsCreating(true)
  }

  const handleSave = async () => {
    console.log("🎭 [PersonaManager] handleSave called with data:", formData)
    
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
        console.log("🎭 [PersonaManager] Updating existing persona:", editingPersona.id)
        await updatePersona(editingPersona.id, formData)
      } else {
        console.log("🎭 [PersonaManager] Creating new persona")
        await addPersona(formData)
      }

      await loadPersonas()
      setIsCreating(false)
      setEditingPersona(null)
      console.log("🎭 [PersonaManager] Persona saved successfully")
    } catch (error) {
      console.error("🎭 [PersonaManager] Error saving persona:", error)
      alert("Failed to save persona. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (persona: Persona) => {
    console.log("🎭 [PersonaManager] handleDelete for persona:", persona.name)
    
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
        console.log("🎭 [PersonaManager] Persona deleted successfully")
        await loadPersonas()
        
        // If this was the active persona, notify parent
        if (persona.isActive && onPersonaActivated) {
          onPersonaActivated(null)
        }
      } else {
        alert("Failed to delete persona")
      }
    } catch (error) {
      console.error("🎭 [PersonaManager] Error deleting persona:", error)
      alert("Failed to delete persona. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async (persona: Persona | null) => {
    const personaId = persona?.id || null
    console.log("🎭 [PersonaManager] handleActivate for persona ID:", personaId)

    setLoading(true)
    try {
      await setActivePersona(personaId)
      await loadPersonas()
      
      if (onPersonaActivated) {
        onPersonaActivated(persona)
      }
      
      console.log("🎭 [PersonaManager] Persona activated:", persona?.name || "None (default mode)")
    } catch (error) {
      console.error("🎭 [PersonaManager] Error activating persona:", error)
      alert("Failed to activate persona. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    console.log("🎭 [PersonaManager] handleCancel - closing form")
    setIsCreating(false)
    setEditingPersona(null)
  }

  const activePersona = personas.find((p) => p.isActive)

  if (isCreating) {
    return (
      <div className="plasmo-flex plasmo-flex-col plasmo-h-full plasmo-p-4 plasmo-bg-gradient-to-b plasmo-from-purple-50 plasmo-to-white dark:plasmo-from-gray-900 dark:plasmo-to-gray-800">
        <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-mb-4 plasmo-flex-shrink-0">
          <h2 className="plasmo-text-xl plasmo-font-bold plasmo-text-purple-900 dark:plasmo-text-purple-100">
            {editingPersona ? "Edit Persona" : "Create New Persona"}
          </h2>
          <button
            onClick={handleCancel}
            className="plasmo-text-gray-500 hover:plasmo-text-gray-700 dark:plasmo-text-gray-400 dark:plasmo-hover:text-gray-200">
            ✕
          </button>
        </div>

        <div className="plasmo-flex-1 plasmo-overflow-y-auto plasmo-space-y-4 plasmo-mb-4">
          <div>
            <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 dark:plasmo-text-gray-300 plasmo-mb-1">
              Emoji
            </label>
            <input
              type="text"
              value={formData.emoji}
              onChange={(e) =>
                setFormData({ ...formData, emoji: e.target.value })
              }
              placeholder="🤖"
              maxLength={2}
              className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-text-2xl plasmo-border plasmo-border-gray-300 plasmo-rounded-lg focus:plasmo-ring-2 focus:plasmo-ring-purple-500 dark:plasmo-bg-gray-700 dark:plasmo-border-gray-600 dark:plasmo-text-white"
            />
          </div>

          <div>
            <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 dark:plasmo-text-gray-300 plasmo-mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Email Writer"
              className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-lg focus:plasmo-ring-2 focus:plasmo-ring-purple-500 dark:plasmo-bg-gray-700 dark:plasmo-border-gray-600 dark:plasmo-text-white"
            />
          </div>

          <div>
            <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 dark:plasmo-text-gray-300 plasmo-mb-1">
              Description *
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Brief description of what this persona does"
              className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-lg focus:plasmo-ring-2 focus:plasmo-ring-purple-500 dark:plasmo-bg-gray-700 dark:plasmo-border-gray-600 dark:plasmo-text-white"
            />
          </div>

          <div>
            <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 dark:plasmo-text-gray-300 plasmo-mb-1">
              Context / Instructions *
            </label>
            <textarea
              value={formData.context}
              onChange={(e) =>
                setFormData({ ...formData, context: e.target.value })
              }
              placeholder="Detailed instructions for how this persona should behave and format responses..."
              rows={8}
              className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-lg focus:plasmo-ring-2 focus:plasmo-ring-purple-500 dark:plasmo-bg-gray-700 dark:plasmo-border-gray-600 dark:plasmo-text-white plasmo-resize-none"
            />
          </div>

          <div>
            <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 dark:plasmo-text-gray-300 plasmo-mb-1">
              Output Template (Optional)
            </label>
            <textarea
              value={formData.outputTemplate}
              onChange={(e) =>
                setFormData({ ...formData, outputTemplate: e.target.value })
              }
              placeholder="Optional template for consistent formatting..."
              rows={4}
              className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-lg focus:plasmo-ring-2 focus:plasmo-ring-purple-500 dark:plasmo-bg-gray-700 dark:plasmo-border-gray-600 dark:plasmo-text-white plasmo-resize-none"
            />
          </div>
        </div>

        <div className="plasmo-flex plasmo-gap-2 plasmo-pt-4 plasmo-border-t plasmo-border-gray-200 dark:plasmo-border-gray-700 plasmo-flex-shrink-0 plasmo-bg-white dark:plasmo-bg-gray-800">
          <button
            onClick={handleSave}
            disabled={loading}
            className="plasmo-flex-1 plasmo-bg-purple-600 plasmo-text-white plasmo-px-4 plasmo-py-2 plasmo-rounded-lg hover:plasmo-bg-purple-700 disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed plasmo-font-medium">
            {loading ? "Saving..." : editingPersona ? "Update" : "Create"}
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="plasmo-px-4 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-lg hover:plasmo-bg-gray-50 dark:plasmo-border-gray-600 dark:plasmo-hover:bg-gray-700 dark:plasmo-text-gray-200">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-h-full plasmo-p-4 plasmo-bg-gradient-to-b plasmo-from-purple-50 plasmo-to-white dark:plasmo-from-gray-900 dark:plasmo-to-gray-800">
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-mb-4">
        <h2 className="plasmo-text-xl plasmo-font-bold plasmo-text-purple-900 dark:plasmo-text-purple-100">
          Manage Personas
        </h2>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="plasmo-bg-purple-600 plasmo-text-white plasmo-px-4 plasmo-py-2 plasmo-rounded-lg hover:plasmo-bg-purple-700 disabled:plasmo-opacity-50 plasmo-text-sm plasmo-font-medium">
          + New Persona
        </button>
      </div>

      {activePersona && (
        <div className="plasmo-mb-4 plasmo-p-3 plasmo-bg-purple-100 dark:plasmo-bg-purple-900/30 plasmo-border plasmo-border-purple-300 dark:plasmo-border-purple-700 plasmo-rounded-lg">
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
            <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
              <span className="plasmo-text-2xl">{activePersona.emoji || "🤖"}</span>
              <div>
                <div className="plasmo-font-medium plasmo-text-purple-900 dark:plasmo-text-purple-100">
                  {activePersona.name}
                </div>
                <div className="plasmo-text-xs plasmo-text-purple-700 dark:plasmo-text-purple-300">
                  Currently Active
                </div>
              </div>
            </div>
            <button
              onClick={() => handleActivate(null)}
              className="plasmo-text-xs plasmo-px-2 plasmo-py-1 plasmo-border plasmo-border-purple-400 dark:plasmo-border-purple-600 plasmo-rounded hover:plasmo-bg-purple-200 dark:plasmo-hover:bg-purple-800 plasmo-text-purple-900 dark:plasmo-text-purple-100">
              Deactivate
            </button>
          </div>
        </div>
      )}

      {!activePersona && (
        <div className="plasmo-mb-4 plasmo-p-3 plasmo-bg-gray-100 dark:plasmo-bg-gray-800 plasmo-border plasmo-border-gray-300 dark:plasmo-border-gray-600 plasmo-rounded-lg plasmo-text-sm plasmo-text-gray-600 dark:plasmo-text-gray-400">
          No persona active. You're in default mode with full tool access.
        </div>
      )}

      <div className="plasmo-flex-1 plasmo-overflow-y-auto plasmo-space-y-2">
        {loading && personas.length === 0 ? (
          <div className="plasmo-text-center plasmo-text-gray-500 dark:plasmo-text-gray-400 plasmo-py-8">
            Loading personas...
          </div>
        ) : personas.length === 0 ? (
          <div className="plasmo-text-center plasmo-text-gray-500 dark:plasmo-text-gray-400 plasmo-py-8">
            No personas yet. Create your first persona to get started!
          </div>
        ) : (
          personas.map((persona) => (
            <div
              key={persona.id}
              className={`p-3 border rounded-lg ${
                persona.isActive
                  ? "border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-800"
              }`}>
              <div className="plasmo-flex plasmo-items-start plasmo-justify-between">
                <div className="plasmo-flex plasmo-items-start plasmo-gap-2 plasmo-flex-1">
                  <span className="plasmo-text-2xl">{persona.emoji || "🤖"}</span>
                  <div className="plasmo-flex-1 plasmo-min-w-0">
                    <div className="plasmo-font-medium plasmo-text-gray-900 dark:plasmo-text-gray-100 plasmo-truncate">
                      {persona.name}
                    </div>
                    <div className="plasmo-text-sm plasmo-text-gray-600 dark:plasmo-text-gray-400 plasmo-line-clamp-2">
                      {persona.description}
                    </div>
                    {persona.isDefault && (
                      <div className="plasmo-text-xs plasmo-text-purple-600 dark:plasmo-text-purple-400 plasmo-mt-1">
                        Default Persona
                      </div>
                    )}
                  </div>
                </div>
                <div className="plasmo-flex plasmo-gap-1 plasmo-ml-2">
                  {!persona.isActive && (
                    <button
                      onClick={() => handleActivate(persona)}
                      disabled={loading}
                      className="plasmo-text-xs plasmo-px-2 plasmo-py-1 plasmo-bg-purple-600 plasmo-text-white plasmo-rounded hover:plasmo-bg-purple-700 disabled:plasmo-opacity-50 plasmo-whitespace-nowrap">
                      Activate
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(persona)}
                    disabled={loading}
                    className="plasmo-text-xs plasmo-px-2 plasmo-py-1 plasmo-border plasmo-border-gray-300 dark:plasmo-border-gray-600 plasmo-rounded hover:plasmo-bg-gray-100 dark:plasmo-hover:bg-gray-700 plasmo-text-gray-700 dark:plasmo-text-gray-300">
                    Edit
                  </button>
                  {!persona.isDefault && (
                    <button
                      onClick={() => handleDelete(persona)}
                      disabled={loading}
                      className="plasmo-text-xs plasmo-px-2 plasmo-py-1 plasmo-border plasmo-border-red-300 dark:plasmo-border-red-700 plasmo-rounded hover:plasmo-bg-red-50 dark:plasmo-hover:bg-red-900/20 plasmo-text-red-600 dark:plasmo-text-red-400">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
