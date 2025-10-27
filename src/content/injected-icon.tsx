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
 *
 * Dropbox-style corner badge design - sits at top-left corner outside the input
 */
export function createInjectedIcon(
  inputElement: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
  onClick: () => void
): HTMLElement {
  // Create a container for the corner badge
  const iconContainer = document.createElement("div")
  iconContainer.className = "mindkeep-icon-container"
  iconContainer.style.cssText = `
    position: fixed !important;
    z-index: 999999 !important;
    pointer-events: auto !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    opacity: 0 !important;
    transition: opacity 0.2s ease, transform 0.2s ease !important;
    transform: translateY(-2px) !important;
  `

  // Position the container relative to the input's position on screen
  const inputRect = inputElement.getBoundingClientRect()

  // Position badge below the text box in bottom-right corner (Grammarly style)
  // The badge should be positioned outside and below the input field
  iconContainer.style.top = `${inputRect.bottom + 4}px` // 4px gap below the input
  iconContainer.style.left = `${inputRect.right - 34}px` // Aligned to right edge with 10px padding

  // Store original input styles to restore later
  const originalBorder = inputElement.style.border || ""
  const originalBoxShadow = inputElement.style.boxShadow || ""
  const originalOutline = inputElement.style.outline || ""
  const originalBorderRadius = inputElement.style.borderRadius || ""

  // Add subtle enhanced border styling to the input (softer than before)
  inputElement.style.border = "2px solid #a78bfa !important"
  inputElement.style.boxShadow = "0 0 0 1px rgba(167, 139, 250, 0.1) !important"
  inputElement.style.outline = "none !important"
  inputElement.style.transition = "all 0.2s ease !important"

  // Append to document body
  document.body.appendChild(iconContainer)

  // Create the corner badge button (Dropbox style - small and subtle)
  const button = document.createElement("button")
  button.type = "button"
  button.style.cssText = `
    width: 24px !important;
    height: 24px !important;
    border-radius: 6px 6px 6px 2px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%) !important;
    color: white !important;
    border: 2px solid white !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    box-shadow: 0 2px 6px rgba(139, 92, 246, 0.4) !important;
    padding: 0 !important;
    margin: 0 !important;
    z-index: 999999 !important;
  `
  button.title = "Ask MindKeep AI"

  // Smaller, cleaner icon
  button.innerHTML = `
    <svg style="width: 14px; height: 14px;" fill="currentColor" viewBox="0 0 24 24">
      <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
    </svg>
  `

  // Add hover effect - subtle lift
  button.addEventListener("mouseenter", () => {
    button.style.transform = "scale(1.1)"
    button.style.boxShadow = "0 4px 10px rgba(139, 92, 246, 0.5) !important"
  })
  button.addEventListener("mouseleave", () => {
    button.style.transform = "scale(1)"
    button.style.boxShadow = "0 2px 6px rgba(139, 92, 246, 0.4) !important"
  })

  button.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log("🎯 [InjectedIcon] Corner badge clicked!")
    onClick()
  })

  iconContainer.appendChild(button)

  // Show icon with fade-in and slide-down animation
  requestAnimationFrame(() => {
    iconContainer.style.opacity = "1"
    iconContainer.style.transform = "translateY(0)"
  })

  // Update icon position on scroll/resize
  const updatePosition = () => {
    const rect = inputElement.getBoundingClientRect()
    iconContainer.style.top = `${rect.bottom + 4}px`
    iconContainer.style.left = `${rect.right - 34}px`
  }

  window.addEventListener("scroll", updatePosition, true)
  window.addEventListener("resize", updatePosition)

  // Store cleanup function and original styles on the icon container
  ;(iconContainer as any).__cleanup = () => {
    window.removeEventListener("scroll", updatePosition, true)
    window.removeEventListener("resize", updatePosition)

    // Restore original input styles
    inputElement.style.border = originalBorder
    inputElement.style.boxShadow = originalBoxShadow
    inputElement.style.outline = originalOutline
    inputElement.style.borderRadius = originalBorderRadius
  }

  console.log(
    "✨ [InjectedIcon] Dropbox-style corner badge created"
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
  // Fade out and slide up animation before removal
  iconElement.style.opacity = "0"
  iconElement.style.transform = "translateY(-2px)"

  setTimeout(() => {
    // Call cleanup function if it exists (this also restores input styles)
    if ((iconElement as any).__cleanup) {
      ;(iconElement as any).__cleanup()
    }

    // Remove the icon
    iconElement.remove()

    console.log("🗑️  [InjectedIcon] Corner badge removed from input")
  }, 200) // Match the transition duration
}
