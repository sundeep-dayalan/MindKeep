/**
 * Injected Icon Component
 *
 * The MindKeep icon that appears in input fields on focus.
 * Clicking it opens the in-page chat modal.
 */

interface InjectedIconProps {
  onClick: () => void
  isActive: boolean
}

export function InjectedIcon({ onClick, isActive }: InjectedIconProps) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      className={`plasmo-absolute plasmo-z-[9999] plasmo-w-6 plasmo-h-6 plasmo-rounded-md plasmo-flex plasmo-items-center plasmo-justify-center plasmo-transition-all plasmo-cursor-pointer plasmo-shadow-sm ${
        isActive
          ? "plasmo-bg-blue-600 plasmo-text-white hover:plasmo-bg-blue-700"
          : "plasmo-bg-slate-100 plasmo-text-slate-600 hover:plasmo-bg-slate-200"
      }`}
      style={{
        bottom: "4px",
        right: "4px"
      }}
      title="Open MindKeep AI"
      type="button">
      {/* MindKeep Logo - Simple brain icon */}
      <svg
        className="plasmo-w-4 plasmo-h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    </button>
  )
}

/**
 * Create and inject the icon into an input field
 * Returns the icon element for management
 */
export function createInjectedIcon(
  inputElement: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
  onClick: () => void
): HTMLElement {
  // Create a container for the React component
  const iconContainer = document.createElement("div")
  iconContainer.className = "mindkeep-icon-container"
  iconContainer.style.cssText = `
    position: fixed !important;
    z-index: 999999 !important;
    pointer-events: auto !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  `

  // Position the container relative to the input's position on screen
  const inputRect = inputElement.getBoundingClientRect()
  const scrollY = window.scrollY || window.pageYOffset
  const scrollX = window.scrollX || window.pageXOffset

  // Position icon in bottom-right corner of input (fixed position)
  iconContainer.style.top = `${inputRect.bottom - 36}px`
  iconContainer.style.left = `${inputRect.right - 36}px`

  // Add padding-right to input to prevent text from going under icon
  const currentPaddingRight = window.getComputedStyle(inputElement).paddingRight
  const currentPaddingValue = parseInt(currentPaddingRight) || 0
  inputElement.style.paddingRight = `${currentPaddingValue + 40}px`

  // Append to document body (not to input - inputs can't have children!)
  document.body.appendChild(iconContainer)

  // Create a simple button directly (no React needed for icon)
  const button = document.createElement("button")
  button.type = "button"
  button.style.cssText = `
    width: 28px !important;
    height: 28px !important;
    border-radius: 6px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    color: white !important;
    border: 2px solid rgba(255, 255, 255, 0.3) !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4) !important;
    padding: 0 !important;
    margin: 0 !important;
    z-index: 999999 !important;
  `
  button.title = "Open MindKeep AI ✨"
  button.innerHTML = `
    <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
    </svg>
  `

  // Add hover effect
  button.addEventListener("mouseenter", () => {
    button.style.transform = "scale(1.1)"
    button.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.6) !important"
  })
  button.addEventListener("mouseleave", () => {
    button.style.transform = "scale(1)"
    button.style.boxShadow = "0 2px 8px rgba(102, 126, 234, 0.4) !important"
  })

  button.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log("🎯 [InjectedIcon] Icon clicked!")
    onClick()
  })

  iconContainer.appendChild(button)

  // Update icon position on scroll/resize
  const updatePosition = () => {
    const rect = inputElement.getBoundingClientRect()
    iconContainer.style.top = `${rect.bottom - 36}px`
    iconContainer.style.left = `${rect.right - 36}px`
  }

  window.addEventListener("scroll", updatePosition, true)
  window.addEventListener("resize", updatePosition)

  // Store cleanup function on the icon container
  ;(iconContainer as any).__cleanup = () => {
    window.removeEventListener("scroll", updatePosition, true)
    window.removeEventListener("resize", updatePosition)
  }

  console.log(
    "✨ [InjectedIcon] Icon created with purple gradient, appended to body"
  )

  return iconContainer
}

/**
 * Remove the injected icon from an input field
 */
export function removeInjectedIcon(
  inputElement: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
  iconElement: HTMLElement
) {
  // Call cleanup function if it exists
  if ((iconElement as any).__cleanup) {
    ;(iconElement as any).__cleanup()
  }

  // Remove the icon
  iconElement.remove()

  // Restore padding
  const currentPaddingRight = window.getComputedStyle(inputElement).paddingRight
  const currentPaddingValue = parseInt(currentPaddingRight) || 0
  const restoredPadding = Math.max(0, currentPaddingValue - 40)
  inputElement.style.paddingRight = `${restoredPadding}px`

  console.log("🗑️  [InjectedIcon] Icon removed from input")
}
