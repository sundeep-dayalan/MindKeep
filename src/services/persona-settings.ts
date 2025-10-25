/**
 * Persona Settings Service
 *
 * Manages user settings related to persona selection using chrome.storage.local
 */

import type { PersonaSettings } from "~types/persona"

const SETTINGS_KEY = "mindkeep_persona_settings"

/**
 * Default settings
 */
const DEFAULT_SETTINGS: PersonaSettings = {
  selectedPersonaId: null,
  defaultPersonaId: null,
  lastUpdated: Date.now()
}

/**
 * Get current persona settings
 *
 * @returns Current settings or defaults if not set
 */
export async function getPersonaSettings(): Promise<PersonaSettings> {
  console.log(" [Settings] getPersonaSettings called")

  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY)
    const settings = result[SETTINGS_KEY] as PersonaSettings | undefined

    if (settings) {
      console.log(" [Settings] Settings loaded:", settings)
      return settings
    }

    console.log(" [Settings] No settings found, using defaults")
    return DEFAULT_SETTINGS
  } catch (error) {
    console.error(" [Settings] Error getting settings:", error)
    return DEFAULT_SETTINGS
  }
}

/**
 * Update persona settings
 *
 * @param updates - Partial settings to update
 * @returns Updated settings
 */
export async function updatePersonaSettings(
  updates: Partial<Omit<PersonaSettings, "lastUpdated">>
): Promise<PersonaSettings> {
  console.log(" [Settings] updatePersonaSettings called with:", updates)

  try {
    const current = await getPersonaSettings()
    const newSettings: PersonaSettings = {
      ...current,
      ...updates,
      lastUpdated: Date.now()
    }

    await chrome.storage.local.set({ [SETTINGS_KEY]: newSettings })
    console.log(" [Settings] Settings updated:", newSettings)

    return newSettings
  } catch (error) {
    console.error(" [Settings] Error updating settings:", error)
    throw error
  }
}

/**
 * Set the selected persona
 *
 * @param personaId - The persona ID to select (null for default mode)
 * @returns Updated settings
 */
export async function setSelectedPersona(
  personaId: string | null
): Promise<PersonaSettings> {
  console.log(" [Settings] setSelectedPersona called with ID:", personaId)

  return updatePersonaSettings({ selectedPersonaId: personaId })
}

/**
 * Get the currently selected persona ID
 *
 * @returns The selected persona ID or null
 */
export async function getSelectedPersonaId(): Promise<string | null> {
  console.log(" [Settings] getSelectedPersonaId called")

  const settings = await getPersonaSettings()
  console.log(" [Settings] Selected persona ID:", settings.selectedPersonaId)

  return settings.selectedPersonaId
}

/**
 * Set the default persona (auto-activated on startup)
 *
 * @param personaId - The persona ID to set as default
 * @returns Updated settings
 */
export async function setDefaultPersona(
  personaId: string | null
): Promise<PersonaSettings> {
  console.log(" [Settings] setDefaultPersona called with ID:", personaId)

  return updatePersonaSettings({ defaultPersonaId: personaId })
}

/**
 * Clear all persona settings (reset to defaults)
 *
 * @returns Default settings
 */
export async function clearPersonaSettings(): Promise<PersonaSettings> {
  console.log(" [Settings] clearPersonaSettings called")

  try {
    await chrome.storage.local.remove(SETTINGS_KEY)
    console.log(" [Settings] Settings cleared")

    return DEFAULT_SETTINGS
  } catch (error) {
    console.error(" [Settings] Error clearing settings:", error)
    throw error
  }
}

/**
 * Listen for settings changes
 *
 * @param callback - Function to call when settings change
 * @returns Cleanup function to remove listener
 */
export function onPersonaSettingsChanged(
  callback: (settings: PersonaSettings) => void
): () => void {
  console.log(" [Settings] Setting up settings change listener")

  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === "local" && changes[SETTINGS_KEY]) {
      const newSettings = changes[SETTINGS_KEY].newValue as PersonaSettings
      console.log(" [Settings] Settings changed:", newSettings)
      callback(newSettings)
    }
  }

  chrome.storage.onChanged.addListener(listener)

  // Return cleanup function
  return () => {
    console.log(" [Settings] Removing settings change listener")
    chrome.storage.onChanged.removeListener(listener)
  }
}
