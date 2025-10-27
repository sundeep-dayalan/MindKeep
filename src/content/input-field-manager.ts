/**
 * Input Field Manager
 *
 * Detects and manages text input fields across web pages.
 * Uses MutationObserver to handle dynamically added fields.
 */

export interface ManagedInputField {
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement
  iconElement: HTMLElement | null
  isActive: boolean
  cursorPosition: number
  selectedText: string
}

export class InputFieldManager {
  private fields: Map<HTMLElement, ManagedInputField> = new Map()
  private observer: MutationObserver | null = null
  private focusListener: ((field: ManagedInputField) => void) | null = null
  private blurListener: ((field: ManagedInputField) => void) | null = null

  /**
   * Check if an element is contenteditable (handles all contenteditable variations)
   */
  private isContentEditable(element: HTMLElement): boolean {
    const contenteditable = element.getAttribute("contenteditable")
    return contenteditable !== null && contenteditable !== "false"
  }

  /**
   * Initialize the manager and start detecting input fields
   */
  initialize(options: {
    onFieldFocus?: (field: ManagedInputField) => void
    onFieldBlur?: (field: ManagedInputField) => void
  }) {
    this.focusListener = options.onFieldFocus || null
    this.blurListener = options.onFieldBlur || null

    // Scan existing fields
    this.scanExistingFields()

    // Setup mutation observer for dynamic fields
    this.setupMutationObserver()

    console.log("📋 [InputFieldManager] Initialized")
  }

  /**
   * Scan for existing input fields on the page
   */
  private scanExistingFields() {
    const selectors = [
      'input[type="text"]',
      'input[type="email"]',
      'input[type="url"]',
      "input:not([type])", // Input without type defaults to text
      'input[type="password"]', // Include password fields as per requirements
      "textarea",
      '[contenteditable="true"]', // Rich text editors like Gmail
      '[contenteditable="plaintext-only"]', // Gmail compose box
      '[contenteditable=""]' // Some editors set empty contenteditable
    ]

    const inputs = document.querySelectorAll(selectors.join(", "))

    inputs.forEach((input) => {
      // Skip search inputs as per requirements
      if (
        input instanceof HTMLInputElement &&
        (input.type === "search" ||
          input.getAttribute("role") === "search" ||
          input.getAttribute("aria-label")?.toLowerCase().includes("search"))
      ) {
        console.log("⏭️  [InputFieldManager] Skipping search field:", input)
        return
      }

      this.registerField(
        input as HTMLInputElement | HTMLTextAreaElement | HTMLElement
      )
    })

    console.log(
      `✅ [InputFieldManager] Registered ${this.fields.size} existing fields`
    )
  }

  /**
   * Setup MutationObserver to detect dynamically added input fields
   */
  private setupMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check added nodes
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement

            // Check if the added node itself is an input
            if (this.isValidInputField(element)) {
              this.registerField(
                element as HTMLInputElement | HTMLTextAreaElement | HTMLElement
              )
            }

            // Check for inputs within the added node
            const inputs = element.querySelectorAll(
              'input[type="text"], input[type="email"], input[type="url"], input[type="password"], input:not([type]), textarea, [contenteditable="true"], [contenteditable="plaintext-only"], [contenteditable=""]'
            )
            inputs.forEach((input) => {
              if (this.isValidInputField(input as HTMLElement)) {
                this.registerField(
                  input as HTMLInputElement | HTMLTextAreaElement | HTMLElement
                )
              }
            })
          }
        })

        // Check removed nodes
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement
            if (this.fields.has(element)) {
              this.unregisterField(element)
            }
          }
        })
      }
    })

    // Observe the entire document, but with optimized configuration
    this.observer.observe(document.body, {
      childList: true, // Watch for added/removed nodes
      subtree: true, // Watch the entire tree
      attributes: false, // Don't watch attribute changes (performance optimization)
      characterData: false // Don't watch text content changes
    })

    console.log("👁️  [InputFieldManager] MutationObserver active")
  }

  /**
   * Check if an element is a valid input field we should manage
   */
  private isValidInputField(element: HTMLElement): boolean {
    // Skip if already registered
    if (this.fields.has(element)) {
      return false
    }

    // Skip MindKeep's own UI elements
    // Check if element or any parent has MindKeep-specific identifiers
    let currentElement: HTMLElement | null = element
    while (currentElement) {
      // Check for MindKeep modal
      if (currentElement.id === "mindkeep-in-page-chat") {
        return false
      }

      // Check for MindKeep class names
      if (currentElement.className && typeof currentElement.className === "string") {
        if (
          currentElement.className.includes("mindkeep-") ||
          currentElement.className.includes("plasmo-")
        ) {
          return false
        }
      }

      currentElement = currentElement.parentElement
    }

    // Check if it's a valid input type
    if (element instanceof HTMLInputElement) {
      const type = element.type.toLowerCase()

      // Skip search inputs
      if (
        type === "search" ||
        element.getAttribute("role") === "search" ||
        element.getAttribute("aria-label")?.toLowerCase().includes("search")
      ) {
        return false
      }

      // Allow text, email, url, password, and inputs without type
      return ["text", "email", "url", "password", ""].includes(type)
    }

    // Allow textareas
    if (element instanceof HTMLTextAreaElement) {
      return true
    }

    // Allow contenteditable elements (like Gmail compose)
    // Check for any contenteditable attribute (true, plaintext-only, etc.)
    if (this.isContentEditable(element)) {
      return true
    }

    return false
  }

  /**
   * Register a new input field
   */
  private registerField(
    element: HTMLInputElement | HTMLTextAreaElement | HTMLElement
  ) {
    if (this.fields.has(element)) {
      return // Already registered
    }

    const field: ManagedInputField = {
      element,
      iconElement: null,
      isActive: false,
      cursorPosition: 0,
      selectedText: ""
    }

    this.fields.set(element, field)

    // Add event listeners
    element.addEventListener("focus", () => {
      console.log(
        "🔔 [InputFieldManager] FOCUS EVENT FIRED for:",
        element.tagName,
        element.getAttribute("type")
      )
      this.handleFieldFocus(field)
    })
    element.addEventListener("blur", () => {
      console.log(
        "🔔 [InputFieldManager] BLUR EVENT FIRED for:",
        element.tagName,
        element.getAttribute("type")
      )
      this.handleFieldBlur(field)
    })

    console.log(
      "➕ [InputFieldManager] Registered field:",
      element.tagName,
      element.getAttribute("type")
    )
  }

  /**
   * Unregister a field that was removed from DOM
   */
  private unregisterField(element: HTMLElement) {
    const field = this.fields.get(element)
    if (!field) return

    // Remove icon if exists
    if (field.iconElement) {
      field.iconElement.remove()
    }

    this.fields.delete(element)
    console.log("➖ [InputFieldManager] Unregistered field:", element.tagName)
  }

  /**
   * Handle field focus event
   */
  private handleFieldFocus(field: ManagedInputField) {
    console.log(
      "🟢 [InputFieldManager] handleFieldFocus called for:",
      field.element.tagName
    )
    field.isActive = true
    this.updateCursorInfo(field)

    if (this.focusListener) {
      console.log("🟢 [InputFieldManager] Calling focusListener callback")
      this.focusListener(field)
    } else {
      console.log("❌ [InputFieldManager] No focusListener registered!")
    }
  }

  /**
   * Handle field blur event
   */
  private handleFieldBlur(field: ManagedInputField) {
    field.isActive = false

    if (this.blurListener) {
      this.blurListener(field)
    }
  }

  /**
   * Update cursor position and selected text for a field
   */
  private updateCursorInfo(field: ManagedInputField) {
    const element = field.element

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      field.cursorPosition = element.selectionStart || 0
      field.selectedText = element.value.substring(
        element.selectionStart || 0,
        element.selectionEnd || 0
      )
    } else if (this.isContentEditable(element)) {
      // For contenteditable, get selection
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        field.selectedText = selection.toString()
        // Cursor position is harder to track in contenteditable, approximate with selection start
        field.cursorPosition = 0
      }
    }
  }

  /**
   * Get the currently focused field, if any
   */
  getFocusedField(): ManagedInputField | null {
    for (const field of this.fields.values()) {
      if (field.isActive) {
        this.updateCursorInfo(field)
        return field
      }
    }
    return null
  }

  /**
   * Get field content
   */
  getFieldContent(field: ManagedInputField): string {
    const element = field.element

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      return element.value
    } else if (this.isContentEditable(element)) {
      return element.textContent || ""
    }

    return ""
  }

  /**
   * Insert text into a field at cursor position
   */
  insertTextAtCursor(field: ManagedInputField, text: string) {
    const element = field.element

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      const start = element.selectionStart || 0
      const end = element.selectionEnd || 0
      const currentValue = element.value

      // Insert text at cursor position
      const newValue =
        currentValue.substring(0, start) + text + currentValue.substring(end)

      element.value = newValue

      // Move cursor to end of inserted text
      const newCursorPos = start + text.length
      element.setSelectionRange(newCursorPos, newCursorPos)

      // Trigger input event for React and other frameworks
      const inputEvent = new Event("input", { bubbles: true })
      element.dispatchEvent(inputEvent)

      console.log("✍️  [InputFieldManager] Inserted text at cursor position")
    } else if (this.isContentEditable(element)) {
      // For contenteditable, use execCommand for better compatibility
      // This works better with Gmail and other rich text editors

      // First, focus the element to ensure it's active
      element.focus()

      // Try using execCommand first (works better with Gmail)
      try {
        // Use insertText command which properly triggers input events
        const success = document.execCommand('insertText', false, text)

        if (success) {
          console.log(
            "✍️  [InputFieldManager] Inserted text into contenteditable using execCommand"
          )
        } else {
          throw new Error("execCommand failed")
        }
      } catch (error) {
        // Fallback to manual insertion if execCommand doesn't work
        console.log("⚠️ [InputFieldManager] execCommand failed, using fallback method")
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          range.deleteContents()
          const textNode = document.createTextNode(text)
          range.insertNode(textNode)

          // Move cursor to end of inserted text
          range.setStartAfter(textNode)
          range.setEndAfter(textNode)
          selection.removeAllRanges()
          selection.addRange(range)

          // Trigger input events manually for frameworks to detect changes
          const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: text
          })
          element.dispatchEvent(inputEvent)

          console.log(
            "✍️  [InputFieldManager] Inserted text into contenteditable using fallback"
          )
        }
      }
    }
  }

  /**
   * Replace selected text or entire field content
   */
  replaceText(
    field: ManagedInputField,
    text: string,
    replaceAll: boolean = false
  ) {
    const element = field.element

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      if (replaceAll) {
        // Replace entire content
        element.value = text
        element.setSelectionRange(text.length, text.length)
      } else {
        // Replace only selected text
        const start = element.selectionStart || 0
        const end = element.selectionEnd || 0

        if (start !== end) {
          // There's a selection, replace it
          const currentValue = element.value
          element.value =
            currentValue.substring(0, start) +
            text +
            currentValue.substring(end)

          // Move cursor to end of replacement
          const newCursorPos = start + text.length
          element.setSelectionRange(newCursorPos, newCursorPos)
        } else {
          // No selection, insert at cursor
          this.insertTextAtCursor(field, text)
        }
      }

      // Trigger input event
      const inputEvent = new Event("input", { bubbles: true })
      element.dispatchEvent(inputEvent)

      console.log(
        "🔄 [InputFieldManager] Replaced text",
        replaceAll ? "(entire content)" : "(selection or cursor)"
      )
    } else if (this.isContentEditable(element)) {
      if (replaceAll) {
        // Focus first
        element.focus()

        // Select all content
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(element)
        selection?.removeAllRanges()
        selection?.addRange(range)

        // Use execCommand to replace (better for Gmail)
        try {
          document.execCommand('insertText', false, text)
        } catch (error) {
          // Fallback
          element.textContent = text

          // Trigger input event
          const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: text
          })
          element.dispatchEvent(inputEvent)
        }
      } else {
        this.insertTextAtCursor(field, text)
      }

      console.log("🔄 [InputFieldManager] Replaced text in contenteditable")
    }
  }

  /**
   * Attach an icon element to a field
   */
  attachIcon(field: ManagedInputField, iconElement: HTMLElement) {
    field.iconElement = iconElement
  }

  /**
   * Remove an icon from a field
   */
  removeIcon(field: ManagedInputField) {
    if (field.iconElement) {
      field.iconElement.remove()
      field.iconElement = null
    }
  }

  /**
   * Cleanup and destroy the manager
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }

    // Remove all icons
    for (const field of this.fields.values()) {
      this.removeIcon(field)
    }

    this.fields.clear()
    console.log("🧹 [InputFieldManager] Cleaned up")
  }
}
