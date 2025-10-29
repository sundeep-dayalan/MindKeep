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
import { logger } from "~utils/logger"

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
  logger.log(" [InPageAssistant] handleFieldFocus called!")
  logger.log(" [InPageAssistant] Field element:", field.element)
  logger.log(" [InPageAssistant] Field has icon?", !!field.iconElement)
  logger.log(" [InPageAssistant] Icon element:", field.iconElement)

  if (!field.iconElement) {
    logger.log(" [InPageAssistant] Creating icon...")
    const icon = createInjectedIcon(field.element, () => openChatModal(field))
    logger.log(" [InPageAssistant] Icon created:", icon)
    logger.log(" [InPageAssistant] Icon display style:", icon.style.display)
    logger.log(" [InPageAssistant] Icon parent:", icon.parentElement)

    if (icon.style.display === "none") {
      logger.log(
        " [InPageAssistant] Icon placeholder created, retrying after delay..."
      )

      setTimeout(() => {
        if (field.isActive && !field.iconElement) {
          logger.log(" [InPageAssistant] Retrying icon creation...")
          const retryIcon = createInjectedIcon(field.element, () =>
            openChatModal(field)
          )
          if (retryIcon.style.display !== "none") {
            fieldManager?.attachIcon(field, retryIcon)
            logger.log(" [InPageAssistant] Icon created on retry")
          }
        }
      }, 100)
    } else {
      fieldManager?.attachIcon(field, icon)
      logger.log(" [InPageAssistant] Icon attached to field")
      logger.log(
        " [InPageAssistant] Field icon element after attach:",
        field.iconElement
      )
    }
  } else {
    logger.log(" [InPageAssistant] Icon already exists, skipping creation")
    logger.log(" [InPageAssistant] Existing icon visibility:", {
      display: field.iconElement.style.display,
      opacity: field.iconElement.style.opacity,
      parent: field.iconElement.parentElement
    })
  }
}

const handleFieldBlur = (field: ManagedInputField) => {
  logger.log(" [InPageAssistant] Field blurred")

  setTimeout(() => {
    if (field.iconElement && !field.isActive) {
      removeInjectedIcon(field.element, field.iconElement)
      fieldManager?.removeIcon(field)
    }
  }, 200)
}

const openChatModal = (field: ManagedInputField) => {
  logger.log(" [InPageAssistant] Opening chat modal")

  const isInIframe = window.self !== window.top
  logger.log(" [InPageAssistant] Running in iframe:", isInIframe)

  closeActiveChat()

  const modalDimensions = { width: 400, height: 500 }
  const position = calculateModalPosition(field.element, modalDimensions)

  logger.log(" [InPageAssistant] Calculated position:", position)
  logger.log(" [InPageAssistant] Viewport:", {
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

    logger.log(
      " [InPageAssistant] Adjusted position for iframe:",
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

  logger.log(" [InPageAssistant] Chat modal opened")
}

const closeActiveChat = () => {
  if (activeChatModal) {
    logger.log(" [InPageAssistant] Closing chat modal")

    activeChatModal.cleanup()

    activeChatModal.root.unmount()

    activeChatModal.modalElement.remove()

    activeChatModal = null
  }
}

const handleInsert = (field: ManagedInputField, text: string) => {
  logger.log(
    " [InPageAssistant] Inserting text:",
    text.substring(0, 50) + "..."
  )

  if (!fieldManager) return

  const hasSelection = field.selectedText && field.selectedText.length > 0

  if (hasSelection) {
    fieldManager.replaceText(field, text, false)
    logger.log(" [InPageAssistant] Replaced selected text")
  } else {
    fieldManager.insertTextAtCursor(field, text)
    logger.log(" [InPageAssistant] Inserted at cursor")
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

logger.log(
  " [InPageAssistant] Script loaded! Document ready state:",
  document.readyState
)

function init() {
  logger.log(" [InPageAssistant] DOM ready, starting initialization")
  logger.log(" [InPageAssistant] Current URL:", window.location.href)
  logger.log(" [InPageAssistant] Document body exists:", !!document.body)

  try {
    fieldManager = new InputFieldManager()
    logger.log(" [InPageAssistant] InputFieldManager created")

    fieldManager.initialize({
      onFieldFocus: handleFieldFocus,
      onFieldBlur: handleFieldBlur
    })
    logger.log(" [InPageAssistant] InputFieldManager initialized")

    window.addEventListener(
      "mindkeep-highlight-insert",
      handleHighlightEvent as EventListener
    )

    logger.log(" [InPageAssistant] Initialization complete!")
  } catch (error) {
    logger.error(" [InPageAssistant] Initialization error:", error)
  }
}

if (document.readyState === "loading") {
  logger.log(" [InPageAssistant] Waiting for DOMContentLoaded...")
  document.addEventListener("DOMContentLoaded", init)
} else {
  logger.log(" [InPageAssistant] DOM already ready, initializing immediately")
  init()
}

window.addEventListener("beforeunload", () => {
  logger.log(" [InPageAssistant] Page unloading, cleaning up")
  if (fieldManager) {
    fieldManager.destroy()
    fieldManager = null
  }
  closeActiveChat()
})
