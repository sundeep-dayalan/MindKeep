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

import "./in-page-assistant.css"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

let fieldManager: InputFieldManager | null = null
let activeChatModal: {
  field: ManagedInputField
  modalElement: HTMLElement
  root: Root
  cleanup: () => void
} | null = null

const handleFieldFocus = (field: ManagedInputField) => {
  console.log("🎯 [InPageAssistant] handleFieldFocus called!")
  console.log("🎯 [InPageAssistant] Field element:", field.element)
  console.log("🎯 [InPageAssistant] Field has icon?", !!field.iconElement)
  console.log("🎯 [InPageAssistant] Icon element:", field.iconElement)

  if (!field.iconElement) {
    console.log("🎯 [InPageAssistant] Creating icon...")
    const icon = createInjectedIcon(field.element, () => openChatModal(field))
    console.log("🎯 [InPageAssistant] Icon created:", icon)
    console.log("🎯 [InPageAssistant] Icon display style:", icon.style.display)
    console.log("🎯 [InPageAssistant] Icon parent:", icon.parentElement)

    if (icon.style.display === "none") {
      console.log(
        "🎯 [InPageAssistant] Icon placeholder created, retrying after delay..."
      )

      setTimeout(() => {
        if (field.isActive && !field.iconElement) {
          console.log("🎯 [InPageAssistant] Retrying icon creation...")
          const retryIcon = createInjectedIcon(field.element, () =>
            openChatModal(field)
          )
          if (retryIcon.style.display !== "none") {
            fieldManager?.attachIcon(field, retryIcon)
            console.log("🎯 [InPageAssistant] Icon created on retry")
          }
        }
      }, 100)
    } else {
      fieldManager?.attachIcon(field, icon)
      console.log("🎯 [InPageAssistant] Icon attached to field")
      console.log(
        "🎯 [InPageAssistant] Field icon element after attach:",
        field.iconElement
      )
    }
  } else {
    console.log("🎯 [InPageAssistant] Icon already exists, skipping creation")
    console.log("🎯 [InPageAssistant] Existing icon visibility:", {
      display: field.iconElement.style.display,
      opacity: field.iconElement.style.opacity,
      parent: field.iconElement.parentElement
    })
  }
}

const handleFieldBlur = (field: ManagedInputField) => {
  console.log("🔄 [InPageAssistant] Field blurred")

  setTimeout(() => {
    if (field.iconElement && !field.isActive) {
      removeInjectedIcon(field.element, field.iconElement)
      fieldManager?.removeIcon(field)
    }
  }, 200)
}

const openChatModal = (field: ManagedInputField) => {
  console.log("💬 [InPageAssistant] Opening chat modal")

  const isInIframe = window.self !== window.top
  console.log("🖼️  [InPageAssistant] Running in iframe:", isInIframe)

  closeActiveChat()

  const modalDimensions = { width: 400, height: 500 }
  const position = calculateModalPosition(field.element, modalDimensions)

  console.log("📍 [InPageAssistant] Calculated position:", position)
  console.log("📏 [InPageAssistant] Viewport:", {
    width: window.innerWidth,
    height: window.innerHeight
  })

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

    adjustedPosition.top = Math.max(10, adjustedPosition.top)
    adjustedPosition.left = Math.max(10, adjustedPosition.left)

    console.log(
      "📍 [InPageAssistant] Adjusted position for iframe:",
      adjustedPosition
    )
    position.top = adjustedPosition.top
    position.left = adjustedPosition.left
  }

  const fieldContent = fieldManager?.getFieldContent(field) || ""

  const modalContainer = document.createElement("div")
  modalContainer.id = "mindkeep-in-page-chat"
  modalContainer.style.cssText =
    "position: fixed; z-index: 999999; pointer-events: none;"
  document.body.appendChild(modalContainer)

  const root = createRoot(modalContainer)

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

  const cleanupTracking = setupPositionTracking(
    field.element,
    modalContainer,
    modalDimensions,
    (newPosition) => {
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

  activeChatModal = {
    field,
    modalElement: modalContainer,
    root,
    cleanup: cleanupTracking
  }

  console.log("✅ [InPageAssistant] Chat modal opened")
}

const closeActiveChat = () => {
  if (activeChatModal) {
    console.log("🔒 [InPageAssistant] Closing chat modal")

    activeChatModal.cleanup()

    activeChatModal.root.unmount()

    activeChatModal.modalElement.remove()

    activeChatModal = null
  }
}

const handleInsert = (field: ManagedInputField, text: string) => {
  console.log(
    "📝 [InPageAssistant] Inserting text:",
    text.substring(0, 50) + "..."
  )

  if (!fieldManager) return

  const hasSelection = field.selectedText && field.selectedText.length > 0

  if (hasSelection) {
    fieldManager.replaceText(field, text, false)
    console.log("✅ [InPageAssistant] Replaced selected text")
  } else {
    fieldManager.insertTextAtCursor(field, text)
    console.log("✅ [InPageAssistant] Inserted at cursor")
  }

  field.element.style.transition = "background-color 0.3s ease"
  field.element.style.backgroundColor = "#dbeafe"
  setTimeout(() => {
    field.element.style.backgroundColor = ""
  }, 500)
}

const handleHighlightEvent = (event: CustomEvent) => {
  if (activeChatModal) {
    const field = activeChatModal.field
    const shouldHighlight = event.detail.highlight

    if (shouldHighlight) {
      field.element.style.transition =
        "box-shadow 0.2s ease, border-color 0.2s ease"
      field.element.style.boxShadow = "0 0 0 3px rgba(34, 197, 94, 0.2)"
      field.element.style.borderColor = "#22c55e"
    } else {
      field.element.style.boxShadow = ""
      field.element.style.borderColor = ""
    }
  }
}

console.log(
  "🚀🚀🚀 [InPageAssistant] Script loaded! Document ready state:",
  document.readyState
)

function init() {
  console.log("✅ [InPageAssistant] DOM ready, starting initialization")
  console.log("📍 [InPageAssistant] Current URL:", window.location.href)
  console.log("📍 [InPageAssistant] Document body exists:", !!document.body)

  try {
    fieldManager = new InputFieldManager()
    console.log("✅ [InPageAssistant] InputFieldManager created")

    fieldManager.initialize({
      onFieldFocus: handleFieldFocus,
      onFieldBlur: handleFieldBlur
    })
    console.log("✅ [InPageAssistant] InputFieldManager initialized")

    window.addEventListener(
      "mindkeep-highlight-insert",
      handleHighlightEvent as EventListener
    )

    console.log("✅✅✅ [InPageAssistant] Initialization complete!")
  } catch (error) {
    console.error("❌ [InPageAssistant] Initialization error:", error)
  }
}

if (document.readyState === "loading") {
  console.log("⏳ [InPageAssistant] Waiting for DOMContentLoaded...")
  document.addEventListener("DOMContentLoaded", init)
} else {
  console.log(
    "✅ [InPageAssistant] DOM already ready, initializing immediately"
  )
  init()
}

window.addEventListener("beforeunload", () => {
  console.log("🧹 [InPageAssistant] Page unloading, cleaning up")
  if (fieldManager) {
    fieldManager.destroy()
    fieldManager = null
  }
  closeActiveChat()
})
