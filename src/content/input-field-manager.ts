

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

  private isContentEditable(element: HTMLElement): boolean {
    const contenteditable = element.getAttribute("contenteditable")
    return contenteditable !== null && contenteditable !== "false"
  }

  initialize(options: {
    onFieldFocus?: (field: ManagedInputField) => void
    onFieldBlur?: (field: ManagedInputField) => void
  }) {
    this.focusListener = options.onFieldFocus || null
    this.blurListener = options.onFieldBlur || null

    this.scanExistingFields()

    this.setupMutationObserver()

    console.log("📋 [InputFieldManager] Initialized")
  }

  private scanExistingFields() {
    const selectors = [
      'input[type="text"]',
      'input[type="email"]',
      'input[type="url"]',
      "input:not([type])",
      'input[type="password"]',
      "textarea",
      '[contenteditable="true"]',
      '[contenteditable="plaintext-only"]',
      '[contenteditable=""]',
      'div[role="textbox"]',
      '[contenteditable]'
    ]

    const inputs = document.querySelectorAll(selectors.join(", "))

    inputs.forEach((input) => {

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

  private setupMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {

        if (mutation.type === "attributes" && mutation.target) {
          const element = mutation.target as HTMLElement

          if (this.isValidInputField(element)) {
            this.registerField(
              element as HTMLInputElement | HTMLTextAreaElement | HTMLElement
            )
          }

          else if (this.fields.has(element)) {
            this.unregisterField(element)
          }
        }

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement

            if (this.isValidInputField(element)) {
              this.registerField(
                element as HTMLInputElement | HTMLTextAreaElement | HTMLElement
              )
            }

            const inputs = element.querySelectorAll(
              'input[type="text"], input[type="email"], input[type="url"], input[type="password"], input:not([type]), textarea, [contenteditable="true"], [contenteditable="plaintext-only"], [contenteditable=""], div[role="textbox"], [contenteditable]'
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

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["contenteditable", "type", "role"],
      characterData: false
    })

    console.log("👁️  [InputFieldManager] MutationObserver active")
  }

  private isValidInputField(element: HTMLElement): boolean {

    if (this.fields.has(element)) {
      return false
    }

    let currentElement: HTMLElement | null = element
    while (currentElement) {

      if (currentElement.id === "mindkeep-in-page-chat") {
        return false
      }

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

    if (element instanceof HTMLInputElement) {
      const type = element.type.toLowerCase()

      if (
        type === "search" ||
        element.getAttribute("role") === "search" ||
        element.getAttribute("aria-label")?.toLowerCase().includes("search")
      ) {
        return false
      }

      return ["text", "email", "url", "password", ""].includes(type)
    }

    if (element instanceof HTMLTextAreaElement) {
      return true
    }

    if (this.isContentEditable(element)) {
      return true
    }

    if (element.getAttribute("role") === "textbox") {
      return true
    }

    return false
  }

  private registerField(
    element: HTMLInputElement | HTMLTextAreaElement | HTMLElement
  ) {
    if (this.fields.has(element)) {
      console.log(
        "⏭️  [InputFieldManager] Field already registered, skipping:",
        element.tagName
      )
      return
    }

    const field: ManagedInputField = {
      element,
      iconElement: null,
      isActive: false,
      cursorPosition: 0,
      selectedText: ""
    }

    this.fields.set(element, field)

    const focusHandler = () => {
      console.log(
        "🔔 [InputFieldManager] FOCUS EVENT FIRED for:",
        element.tagName,
        element.getAttribute("type")
      )

      const currentField = this.fields.get(element)
      if (currentField) {
        this.handleFieldFocus(currentField)
      }
    }

    const blurHandler = () => {
      console.log(
        "🔔 [InputFieldManager] BLUR EVENT FIRED for:",
        element.tagName,
        element.getAttribute("type")
      )

      const currentField = this.fields.get(element)
      if (currentField) {
        this.handleFieldBlur(currentField)
      }
    }

    element.addEventListener("focus", focusHandler)
    element.addEventListener("blur", blurHandler)

    console.log(
      "➕ [InputFieldManager] Registered field:",
      element.tagName,
      element.getAttribute("type")
    )
  }

  private unregisterField(element: HTMLElement) {
    const field = this.fields.get(element)
    if (!field) return

    if (field.iconElement) {
      field.iconElement.remove()
    }

    this.fields.delete(element)
    console.log("➖ [InputFieldManager] Unregistered field:", element.tagName)
  }

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

  private handleFieldBlur(field: ManagedInputField) {
    field.isActive = false

    if (this.blurListener) {
      this.blurListener(field)
    }
  }

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

      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        field.selectedText = selection.toString()

        field.cursorPosition = 0
      }
    }
  }

  getFocusedField(): ManagedInputField | null {
    for (const field of this.fields.values()) {
      if (field.isActive) {
        this.updateCursorInfo(field)
        return field
      }
    }
    return null
  }

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

  insertTextAtCursor(field: ManagedInputField, text: string) {
    const element = field.element

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      const start = element.selectionStart || 0
      const end = element.selectionEnd || 0
      const currentValue = element.value

      const newValue =
        currentValue.substring(0, start) + text + currentValue.substring(end)

      element.value = newValue

      const newCursorPos = start + text.length
      element.setSelectionRange(newCursorPos, newCursorPos)

      const inputEvent = new Event("input", { bubbles: true })
      element.dispatchEvent(inputEvent)

      console.log("✍️  [InputFieldManager] Inserted text at cursor position")
    } else if (this.isContentEditable(element)) {

      element.focus()

      try {

        const success = document.execCommand('insertText', false, text)

        if (success) {
          console.log(
            "✍️  [InputFieldManager] Inserted text into contenteditable using execCommand"
          )
        } else {
          throw new Error("execCommand failed")
        }
      } catch (error) {

        console.log("⚠️ [InputFieldManager] execCommand failed, using fallback method")
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          range.deleteContents()
          const textNode = document.createTextNode(text)
          range.insertNode(textNode)

          range.setStartAfter(textNode)
          range.setEndAfter(textNode)
          selection.removeAllRanges()
          selection.addRange(range)

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

        element.value = text
        element.setSelectionRange(text.length, text.length)
      } else {

        const start = element.selectionStart || 0
        const end = element.selectionEnd || 0

        if (start !== end) {

          const currentValue = element.value
          element.value =
            currentValue.substring(0, start) +
            text +
            currentValue.substring(end)

          const newCursorPos = start + text.length
          element.setSelectionRange(newCursorPos, newCursorPos)
        } else {

          this.insertTextAtCursor(field, text)
        }
      }

      const inputEvent = new Event("input", { bubbles: true })
      element.dispatchEvent(inputEvent)

      console.log(
        "🔄 [InputFieldManager] Replaced text",
        replaceAll ? "(entire content)" : "(selection or cursor)"
      )
    } else if (this.isContentEditable(element)) {
      if (replaceAll) {

        element.focus()

        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(element)
        selection?.removeAllRanges()
        selection?.addRange(range)

        try {
          document.execCommand('insertText', false, text)
        } catch (error) {

          element.textContent = text

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

  attachIcon(field: ManagedInputField, iconElement: HTMLElement) {
    field.iconElement = iconElement
  }

  removeIcon(field: ManagedInputField) {
    if (field.iconElement) {
      field.iconElement.remove()
      field.iconElement = null
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }

    for (const field of this.fields.values()) {
      this.removeIcon(field)
    }

    this.fields.clear()
    console.log("🧹 [InputFieldManager] Cleaned up")
  }
}
