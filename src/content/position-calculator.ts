export interface Position {
  top: number
  left: number
  placement: "top" | "bottom" | "left" | "right"
}

export interface Dimensions {
  width: number
  height: number
}

export function calculateModalPosition(
  inputElement: HTMLElement,
  modalDimensions: Dimensions
): Position {
  const inputRect = inputElement.getBoundingClientRect()
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  }

  const SPACING = 12
  const EDGE_PADDING = 16

  const spaceAbove = inputRect.top
  const spaceBelow = viewport.height - inputRect.bottom
  const spaceLeft = inputRect.left
  const spaceRight = viewport.width - inputRect.right

  let placement: "top" | "bottom" | "left" | "right"
  let top: number
  let left: number

  if (spaceRight >= modalDimensions.width + SPACING + EDGE_PADDING) {
    placement = "right"
    left = inputRect.right + SPACING
    top = inputRect.top

    if (top + modalDimensions.height > viewport.height - EDGE_PADDING) {
      top = viewport.height - modalDimensions.height - EDGE_PADDING
    }
    if (top < EDGE_PADDING) {
      top = EDGE_PADDING
    }
  } else if (spaceBelow >= modalDimensions.height + SPACING + EDGE_PADDING) {
    placement = "bottom"
    top = inputRect.bottom + SPACING
    left = inputRect.left

    if (left + modalDimensions.width > viewport.width - EDGE_PADDING) {
      left = viewport.width - modalDimensions.width - EDGE_PADDING
    }
    if (left < EDGE_PADDING) {
      left = EDGE_PADDING
    }
  } else if (spaceLeft >= modalDimensions.width + SPACING + EDGE_PADDING) {
    placement = "left"
    left = inputRect.left - modalDimensions.width - SPACING
    top = inputRect.top

    if (top + modalDimensions.height > viewport.height - EDGE_PADDING) {
      top = viewport.height - modalDimensions.height - EDGE_PADDING
    }
    if (top < EDGE_PADDING) {
      top = EDGE_PADDING
    }
  } else if (spaceAbove >= modalDimensions.height + SPACING + EDGE_PADDING) {
    placement = "top"
    top = inputRect.top - modalDimensions.height - SPACING
    left = inputRect.left

    if (left + modalDimensions.width > viewport.width - EDGE_PADDING) {
      left = viewport.width - modalDimensions.width - EDGE_PADDING
    }
    if (left < EDGE_PADDING) {
      left = EDGE_PADDING
    }
  } else {
    placement = "bottom"
    left = Math.max(EDGE_PADDING, (viewport.width - modalDimensions.width) / 2)
    top = Math.max(EDGE_PADDING, (viewport.height - modalDimensions.height) / 2)
  }

  return { top, left, placement }
}

export function calculateIconPosition(inputElement: HTMLElement): {
  top: string
  right: string
} {
  const PADDING = 8

  return {
    top: "auto",
    right: `${PADDING}px`
  }
}

export function setupPositionTracking(
  inputElement: HTMLElement,
  modalElement: HTMLElement,
  modalDimensions: Dimensions,
  onPositionChange: (position: Position) => void
) {
  const updatePosition = () => {
    const position = calculateModalPosition(inputElement, modalDimensions)
    onPositionChange(position)
  }

  window.addEventListener("scroll", updatePosition, true)
  window.addEventListener("resize", updatePosition)

  updatePosition()

  return () => {
    window.removeEventListener("scroll", updatePosition, true)
    window.removeEventListener("resize", updatePosition)
  }
}
