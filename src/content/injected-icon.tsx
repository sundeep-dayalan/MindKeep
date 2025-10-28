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
      {}
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

export function createInjectedIcon(
  inputElement: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
  onClick: () => void
): HTMLElement {
  const isVisible = (element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    )
  }

  if (!isVisible(inputElement)) {
    console.log(
      "⚠️ [InjectedIcon] Input field not visible, delaying icon creation"
    )

    const placeholder = document.createElement("div")
    placeholder.style.display = "none"
    return placeholder
  }

  const iconContainer = document.createElement("div")
  iconContainer.className = "mindkeep-icon-container"
  iconContainer.style.cssText = `
    position: fixed !important;
    z-index: 999999 !important;
    pointer-events: auto !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.2s ease;
    transform: translateY(-2px);
  `

  const updateInitialPosition = () => {
    const inputRect = inputElement.getBoundingClientRect()

    console.log("[InjectedIcon] Input rect:", {
      top: inputRect.top,
      bottom: inputRect.bottom,
      left: inputRect.left,
      right: inputRect.right,
      width: inputRect.width,
      height: inputRect.height
    })

    const iconTop = inputRect.bottom + 4
    const iconLeft = inputRect.right - 34

    iconContainer.style.top = `${iconTop}px`
    iconContainer.style.left = `${iconLeft}px`

    console.log("[InjectedIcon] Icon position set to:", {
      top: iconTop,
      left: iconLeft,
      viewport: { width: window.innerWidth, height: window.innerHeight }
    })
  }

  updateInitialPosition()

  setTimeout(updateInitialPosition, 50)

  const originalBorder = inputElement.style.border || ""
  const originalBoxShadow = inputElement.style.boxShadow || ""
  const originalOutline = inputElement.style.outline || ""
  const originalBorderRadius = inputElement.style.borderRadius || ""

  inputElement.style.border = "2px solid #a78bfa !important"
  inputElement.style.boxShadow = "0 0 0 1px rgba(167, 139, 250, 0.1) !important"
  inputElement.style.outline = "none !important"
  inputElement.style.transition = "all 0.2s ease !important"

  document.body.appendChild(iconContainer)

  const button = document.createElement("button")
  button.type = "button"
  button.style.cssText = `
    width: 24px !important;
    height: 24px !important;
    border-radius: 50% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: #F59E0B !important;
    border: none !important;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12) !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    padding: 5px !important;
    margin: 0 !important;
    z-index: 999999 !important;
  `

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", "0 0 24 24")
  svg.setAttribute("fill", "white")
  svg.style.cssText = `
    width: 14px !important;
    height: 14px !important;
    display: block !important;
    pointer-events: none !important;
  `

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
  path.setAttribute(
    "d",
    "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"
  )

  svg.appendChild(path)
  button.appendChild(svg)

  const tooltip = document.createElement("div")
  tooltip.className = "mindkeep-tooltip"
  tooltip.style.cssText = `
    position: absolute !important;
    right: 100% !important;
    top: 50% !important;
    transform: translateY(-50%) translateX(-8px) !important;
    background: #1F2937 !important;
    color: white !important;
    padding: 6px 12px !important;
    border-radius: 6px !important;
    font-size: 13px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    white-space: nowrap !important;
    opacity: 0 !important;
    pointer-events: none !important;
    transition: opacity 0.2s ease, transform 0.2s ease !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
    z-index: 999999 !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
  `

  tooltip.textContent = "Search your notes"

  iconContainer.appendChild(tooltip)

  button.addEventListener("mouseenter", () => {
    button.style.transform = "scale(1.15)"
    button.style.boxShadow = "0 4px 14px rgba(245, 158, 11, 0.5)"
    tooltip.style.opacity = "1"
    tooltip.style.transform = "translateY(-50%) translateX(-4px)"
  })
  button.addEventListener("mouseleave", () => {
    button.style.transform = "scale(1)"
    button.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.12)"
    tooltip.style.opacity = "0"
    tooltip.style.transform = "translateY(-50%) translateX(-8px)"
  })

  button.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log("🎯 [InjectedIcon] Corner badge clicked!")
    onClick()
  })

  iconContainer.appendChild(button)

  console.log("[InjectedIcon] Preparing to show icon with animation")
  requestAnimationFrame(() => {
    console.log(
      "[InjectedIcon] Setting opacity to 1 and transform to translateY(0)"
    )
    iconContainer.style.opacity = "1"
    iconContainer.style.transform = "translateY(0)"
    console.log(
      "[InjectedIcon] Icon should now be visible, opacity:",
      iconContainer.style.opacity
    )
  })

  const updatePosition = () => {
    const rect = inputElement.getBoundingClientRect()
    iconContainer.style.top = `${rect.bottom + 4}px`
    iconContainer.style.left = `${rect.right - 34}px`
  }

  window.addEventListener("scroll", updatePosition, true)
  window.addEventListener("resize", updatePosition)
  ;(iconContainer as any).__cleanup = () => {
    window.removeEventListener("scroll", updatePosition, true)
    window.removeEventListener("resize", updatePosition)

    inputElement.style.border = originalBorder
    inputElement.style.boxShadow = originalBoxShadow
    inputElement.style.outline = originalOutline
    inputElement.style.borderRadius = originalBorderRadius
  }

  console.log(
    "✨ [InjectedIcon] MindKeep icon badge created and attached to DOM"
  )

  return iconContainer
}

export function removeInjectedIcon(
  inputElement: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
  iconElement: HTMLElement
) {
  iconElement.style.opacity = "0"
  iconElement.style.transform = "translateY(-2px)"

  setTimeout(() => {
    if ((iconElement as any).__cleanup) {
      ;(iconElement as any).__cleanup()
    }

    iconElement.remove()

    console.log("🗑️  [InjectedIcon] Corner badge removed from input")
  }, 200)
}
