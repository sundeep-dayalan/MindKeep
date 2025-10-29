import type { PersonaSettings } from "~types/persona"
import { logger } from "~utils/logger"

const SETTINGS_KEY = "mindkeep_persona_settings"

const DEFAULT_SETTINGS: PersonaSettings = {
  selectedPersonaId: null,
  defaultPersonaId: null,
  lastUpdated: Date.now()
}

export async function getPersonaSettings(): Promise<PersonaSettings> {
  logger.log(" [Settings] getPersonaSettings called")

  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY)
    const settings = result[SETTINGS_KEY] as PersonaSettings | undefined

    if (settings) {
      logger.log(" [Settings] Settings loaded:", settings)
      return settings
    }

    logger.log(" [Settings] No settings found, using defaults")
    return DEFAULT_SETTINGS
  } catch (error) {
    logger.error(" [Settings] Error getting settings:", error)
    return DEFAULT_SETTINGS
  }
}

export async function updatePersonaSettings(
  updates: Partial<Omit<PersonaSettings, "lastUpdated">>
): Promise<PersonaSettings> {
  logger.log(" [Settings] updatePersonaSettings called with:", updates)

  try {
    const current = await getPersonaSettings()
    const newSettings: PersonaSettings = {
      ...current,
      ...updates,
      lastUpdated: Date.now()
    }

    await chrome.storage.local.set({ [SETTINGS_KEY]: newSettings })
    logger.log(" [Settings] Settings updated:", newSettings)

    return newSettings
  } catch (error) {
    logger.error(" [Settings] Error updating settings:", error)
    throw error
  }
}

export async function setSelectedPersona(
  personaId: string | null
): Promise<PersonaSettings> {
  logger.log(" [Settings] setSelectedPersona called with ID:", personaId)

  return updatePersonaSettings({ selectedPersonaId: personaId })
}

export async function getSelectedPersonaId(): Promise<string | null> {
  logger.log(" [Settings] getSelectedPersonaId called")

  const settings = await getPersonaSettings()
  logger.log(" [Settings] Selected persona ID:", settings.selectedPersonaId)

  return settings.selectedPersonaId
}

export async function setDefaultPersona(
  personaId: string | null
): Promise<PersonaSettings> {
  logger.log(" [Settings] setDefaultPersona called with ID:", personaId)

  return updatePersonaSettings({ defaultPersonaId: personaId })
}

export async function clearPersonaSettings(): Promise<PersonaSettings> {
  logger.log(" [Settings] clearPersonaSettings called")

  try {
    await chrome.storage.local.remove(SETTINGS_KEY)
    logger.log(" [Settings] Settings cleared")

    return DEFAULT_SETTINGS
  } catch (error) {
    logger.error(" [Settings] Error clearing settings:", error)
    throw error
  }
}

export function onPersonaSettingsChanged(
  callback: (settings: PersonaSettings) => void
): () => void {
  logger.log(" [Settings] Setting up settings change listener")

  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === "local" && changes[SETTINGS_KEY]) {
      const newSettings = changes[SETTINGS_KEY].newValue as PersonaSettings
      logger.log(" [Settings] Settings changed:", newSettings)
      callback(newSettings)
    }
  }

  chrome.storage.onChanged.addListener(listener)

  return () => {
    logger.log(" [Settings] Removing settings change listener")
    chrome.storage.onChanged.removeListener(listener)
  }
}
