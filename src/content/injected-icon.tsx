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

  // Create the button with transparent background - just the Lottie logo
  const button = document.createElement("button")
  button.type = "button"
  button.style.cssText = `
    width: 28px !important;
    height: 28px !important;
    border-radius: 50% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: transparent !important;
    color: white !important;
    border: none !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    padding: 0 !important;
    margin: 0 !important;
    z-index: 999999 !important;
  `
  button.title = "Ask MindKeep AI"

  // Create container for Lottie animation
  const lottieContainer = document.createElement("div")
  lottieContainer.style.cssText = `
    width: 28px !important;
    height: 28px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  `

  // Create dotlottie-player element
  const lottiePlayer = document.createElement("dotlottie-player")
  lottiePlayer.setAttribute("src", "https://lottie.host/523463c6-9440-4e42-bc0a-318978a9b8a2/S2YUnZFAfy.lottie")
  lottiePlayer.setAttribute("background", "transparent")
  lottiePlayer.setAttribute("speed", "1")
  lottiePlayer.setAttribute("loop", "true")
  lottiePlayer.setAttribute("autoplay", "true")
  lottiePlayer.style.cssText = `
    width: 100% !important;
    height: 100% !important;
  `

  lottieContainer.appendChild(lottiePlayer)
  button.appendChild(lottieContainer)

  // Load dotlottie-player script if not already loaded
  if (!document.querySelector('script[src*="dotlottie-player"]')) {
    const script = document.createElement("script")
    script.src = "https://unpkg.com/@dotlottie/player-component@latest/dist/dotlottie-player.mjs"
    script.type = "module"
    document.head.appendChild(script)
  }

  // Add hover effect - subtle scale
  button.addEventListener("mouseenter", () => {
    button.style.transform = "scale(1.15)"
  })
  button.addEventListener("mouseleave", () => {
    button.style.transform = "scale(1)"
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
