/**
 * Base Content Script
 *
 * Handles context menu integration for saving selected text to MindKeep.
 * The in-page AI assistant functionality is now in contents/in-page-assistant.tsx
 */

import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

// Content script for context menu - no UI overlay needed
const PlasmoOverlay = () => {
  return null
}

export default PlasmoOverlay

// ==================== CONTEXT MENU SUPPORT ====================

/**
 * Listen for messages from background script to capture selected HTML
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_SELECTED_HTML") {
    const selection = window.getSelection()

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const container = document.createElement("div")
      container.appendChild(range.cloneContents())

      sendResponse({
        html: container.innerHTML,
        text: selection.toString()
      })
    } else {
      sendResponse({ html: "", text: "" })
    }

    return true // Keep the message channel open for async response
  }
})
