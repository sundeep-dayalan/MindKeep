export function isExtensionContextValid(): boolean {
  try {
    if (!chrome?.runtime?.id) {
      return false
    }
    return true
  } catch (error) {
    return false
  }
}

export async function safeExtensionCall<T>(
  fn: () => Promise<T>,
  fallback?: T
): Promise<T | null> {
  if (!isExtensionContextValid()) {
    console.warn(
      "⚠️  [ExtensionContext] Extension context is invalid, skipping API call"
    )
    return fallback ?? null
  }

  try {
    return await fn()
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Extension context invalidated")
    ) {
      console.warn(
        "⚠️  [ExtensionContext] Extension context invalidated during API call:",
        error.message
      )
      return fallback ?? null
    }

    throw error
  }
}

export function safeAddStorageListener(
  listener: (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => void
): (() => void) | null {
  if (!isExtensionContextValid()) {
    console.warn(
      "⚠️  [ExtensionContext] Cannot add storage listener - context invalid"
    )
    return null
  }

  try {
    chrome.storage.onChanged.addListener(listener)
    return () => {
      try {
        if (isExtensionContextValid()) {
          chrome.storage.onChanged.removeListener(listener)
        }
      } catch (error) {
        console.debug(
          "Failed to remove storage listener (context may be invalid)"
        )
      }
    }
  } catch (error) {
    console.warn(
      "⚠️  [ExtensionContext] Failed to add storage listener:",
      error
    )
    return null
  }
}

export function showExtensionReloadMessage() {
  const isContentScript =
    typeof window !== "undefined" &&
    (window.location.protocol === "http:" ||
      window.location.protocol === "https:")

  if (!isContentScript) {
    return
  }

  console.log(
    "%c🔄 Extension Updated",
    "color: #3B82F6; font-size: 14px; font-weight: bold;",
    "\nThe MindKeep extension has been updated. Please refresh the page to use the latest version."
  )
}
