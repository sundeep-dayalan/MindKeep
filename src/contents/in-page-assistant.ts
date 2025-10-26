/**
 * In-Page Assistant Content Script
 *
 * Main orchestrator for the in-page AI assistant feature.
 * Manages input field detection, icon injection, and chat modal display.
 */

import type { PlasmoCSConfig } from "plasmo"
import React from "react"
import { createRoot, type Root } from "react-dom/client"

import { InPageChatModal } from "~content/in-page-chat-modal"
import { createInjectedIcon, removeInjectedIcon } from "~content/injected-icon"
import {
  InputFieldManager,
  type ManagedInputField
} from "~content/input-field-manager"
import {
  calculateModalPosition,
  setupPositionTracking
} from "~content/position-calculator"

// Import the CSS file - Plasmo will automatically inject it
import "./in-page-assistant.css"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true // Run in all frames including iframes
}

// Global state
let fieldManager: InputFieldManager | null = null
let activeChatModal: {
  field: ManagedInputField
  modalElement: HTMLElement
  root: Root
  cleanup: () => void
} | null = null

/**
 * Handle when an input field receives focus
 */
const handleFieldFocus = (field: ManagedInputField) => {
  console.log("🎯🎯🎯 [InPageAssistant] handleFieldFocus called!")
  console.log("🎯 [InPageAssistant] Field element:", field.element)
  console.log("🎯 [InPageAssistant] Field has icon?", !!field.iconElement)

  // Create and attach icon if not already present
  if (!field.iconElement) {
    console.log("🎯 [InPageAssistant] Creating icon...")
    const icon = createInjectedIcon(field.element, () => openChatModal(field))
    console.log("🎯 [InPageAssistant] Icon created:", icon)
    fieldManager?.attachIcon(field, icon)
    console.log("🎯 [InPageAssistant] Icon attached to field")
  } else {
    console.log("🎯 [InPageAssistant] Icon already exists, skipping creation")
  }
}

/**
 * Handle when an input field loses focus
 */
const handleFieldBlur = (field: ManagedInputField) => {
  console.log("🔄 [InPageAssistant] Field blurred")

  // Remove icon after a delay (to allow clicking the icon)
  setTimeout(() => {
    if (field.iconElement && !field.isActive) {
      removeInjectedIcon(field.element, field.iconElement)
      fieldManager?.removeIcon(field)
    }
  }, 200)
}

/**
 * Open the chat modal for a specific input field
 */
const openChatModal = (field: ManagedInputField) => {
  console.log("💬 [InPageAssistant] Opening chat modal")

  // Detect if we're in an iframe
  const isInIframe = window.self !== window.top
  console.log("🖼️  [InPageAssistant] Running in iframe:", isInIframe)

  // Close any existing chat
  closeActiveChat()

  // Calculate position
  const modalDimensions = { width: 400, height: 500 }
  const position = calculateModalPosition(field.element, modalDimensions)

  console.log("📍 [InPageAssistant] Calculated position:", position)
  console.log("📏 [InPageAssistant] Viewport:", {
    width: window.innerWidth,
    height: window.innerHeight
  })

  // If in iframe, adjust position to ensure it's visible
  if (isInIframe) {
    const adjustedPosition = {
      top: Math.min(
        position.top,
        window.innerHeight - modalDimensions.height - 20
      ),
      left: Math.min(
        position.left,
        window.innerWidth - modalDimensions.width - 20
      )
    }
    // Ensure not negative
    adjustedPosition.top = Math.max(10, adjustedPosition.top)
    adjustedPosition.left = Math.max(10, adjustedPosition.left)

    console.log(
      "📍 [InPageAssistant] Adjusted position for iframe:",
      adjustedPosition
    )
    position.top = adjustedPosition.top
    position.left = adjustedPosition.left
  }

  // Get input field content for context
  const fieldContent = fieldManager?.getFieldContent(field) || ""

  // Create modal container
  const modalContainer = document.createElement("div")
  modalContainer.id = "mindkeep-in-page-chat"
  modalContainer.style.cssText =
    "position: fixed; z-index: 999999; pointer-events: none;"
  document.body.appendChild(modalContainer)

  // Create React root
  const root = createRoot(modalContainer)

  // Render modal
  root.render(
    React.createElement(
      "div",
      { style: { pointerEvents: "auto" } },
      React.createElement(InPageChatModal, {
        position: position,
        onClose: () => closeActiveChat(),
        onInsert: (text: string) => handleInsert(field, text),
        inputFieldContent: fieldContent
      })
    )
  )

  // Setup position tracking for scroll/resize
  const cleanupTracking = setupPositionTracking(
    field.element,
    modalContainer,
    modalDimensions,
    (newPosition) => {
      // Re-render with new position
      root.render(
        React.createElement(
          "div",
          { style: { pointerEvents: "auto" } },
          React.createElement(InPageChatModal, {
            position: newPosition,
            onClose: () => closeActiveChat(),
            onInsert: (text: string) => handleInsert(field, text),
            inputFieldContent: fieldContent
          })
        )
      )
    }
  )

  // Store active chat reference
  activeChatModal = {
    field,
    modalElement: modalContainer,
    root,
    cleanup: cleanupTracking
  }

  console.log("✅ [InPageAssistant] Chat modal opened")
}

/**
 * Close the active chat modal
 */
const closeActiveChat = () => {
  if (activeChatModal) {
    console.log("🔒 [InPageAssistant] Closing chat modal")

    // Cleanup position tracking
    activeChatModal.cleanup()

    // Unmount React component
    activeChatModal.root.unmount()

    // Remove modal container
    activeChatModal.modalElement.remove()

    activeChatModal = null
  }
}

/**
 * Handle text insertion into the input field
 */
const handleInsert = (field: ManagedInputField, text: string) => {
  console.log(
    "📝 [InPageAssistant] Inserting text:",
    text.substring(0, 50) + "..."
  )

  if (!fieldManager) return

  // Determine insertion mode based on selection
  const hasSelection = field.selectedText && field.selectedText.length > 0

  if (hasSelection) {
    // Replace selected text
    fieldManager.replaceText(field, text, false)
    console.log("✅ [InPageAssistant] Replaced selected text")
  } else {
    // Insert at cursor position
    fieldManager.insertTextAtCursor(field, text)
    console.log("✅ [InPageAssistant] Inserted at cursor")
  }

  // Visual feedback (highlight the input briefly)
  field.element.style.transition = "background-color 0.3s ease"
  field.element.style.backgroundColor = "#dbeafe" // Light blue
  setTimeout(() => {
    field.element.style.backgroundColor = ""
  }, 500)
}

/**
 * Handle highlight events from modal
 */
const handleHighlightEvent = (event: CustomEvent) => {
  if (activeChatModal) {
    const field = activeChatModal.field
    const shouldHighlight = event.detail.highlight

    if (shouldHighlight) {
      // Add highlight effect
      field.element.style.transition =
        "box-shadow 0.2s ease, border-color 0.2s ease"
      field.element.style.boxShadow = "0 0 0 3px rgba(34, 197, 94, 0.2)"
      field.element.style.borderColor = "#22c55e"
    } else {
      // Remove highlight effect
      field.element.style.boxShadow = ""
      field.element.style.borderColor = ""
    }
  }
}

/**
 * Initialize the in-page assistant
 */
console.log(
  "🚀🚀🚀 [InPageAssistant] Script loaded! Document ready state:",
  document.readyState
)

function init() {
  console.log("✅ [InPageAssistant] DOM ready, starting initialization")
  console.log("📍 [InPageAssistant] Current URL:", window.location.href)
  console.log("📍 [InPageAssistant] Document body exists:", !!document.body)

  try {
    // Initialize field manager
    fieldManager = new InputFieldManager()
    console.log("✅ [InPageAssistant] InputFieldManager created")

    fieldManager.initialize({
      onFieldFocus: handleFieldFocus,
      onFieldBlur: handleFieldBlur
    })
    console.log("✅ [InPageAssistant] InputFieldManager initialized")

    // Listen for highlight events from modal
    window.addEventListener(
      "mindkeep-highlight-insert",
      handleHighlightEvent as EventListener
    )

    console.log("✅✅✅ [InPageAssistant] Initialization complete!")
  } catch (error) {
    console.error("❌ [InPageAssistant] Initialization error:", error)
  }
}

// Wait for DOM to be ready
if (document.readyState === "loading") {
  console.log("⏳ [InPageAssistant] Waiting for DOMContentLoaded...")
  document.addEventListener("DOMContentLoaded", init)
} else {
  console.log(
    "✅ [InPageAssistant] DOM already ready, initializing immediately"
  )
  init()
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  console.log("🧹 [InPageAssistant] Page unloading, cleaning up")
  if (fieldManager) {
    fieldManager.destroy()
    fieldManager = null
  }
  closeActiveChat()
})
