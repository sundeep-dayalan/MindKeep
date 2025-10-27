/**
 * Extension Context Utilities
 *
 * Helpers for detecting and handling invalidated extension contexts.
 * When an extension is reloaded while content scripts are running,
 * any chrome.runtime or chrome.storage API calls will fail.
 */

/**
 * Check if the extension context is still valid
 * Returns false if the extension has been reloaded/updated
 */
export function isExtensionContextValid(): boolean {
  try {
    // Try to access chrome.runtime.id - this will throw if context is invalid
    if (!chrome?.runtime?.id) {
      return false
    }
    return true
  } catch (error) {
    return false
  }
}

/**
 * Safely execute a function that uses chrome extension APIs
 * Returns null if the extension context is invalid
 */
export async function safeExtensionCall<T>(
  fn: () => Promise<T>,
  fallback?: T
): Promise<T | null> {
  if (!isExtensionContextValid()) {
    console.warn("⚠️  [ExtensionContext] Extension context is invalid, skipping API call")
    return fallback ?? null
  }

  try {
    return await fn()
  } catch (error) {
    // Check if error is due to invalidated context
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
    // Re-throw other errors
    throw error
  }
}

/**
 * Safely add a chrome.storage listener
 * Returns a cleanup function, or null if context is invalid
 */
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
        // Silently ignore cleanup errors
        console.debug("Failed to remove storage listener (context may be invalid)")
      }
    }
  } catch (error) {
    console.warn("⚠️  [ExtensionContext] Failed to add storage listener:", error)
    return null
  }
}

/**
 * Show a user-friendly message when extension context is invalidated
 */
export function showExtensionReloadMessage() {
  // Only show in content script contexts (not in extension pages)
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
