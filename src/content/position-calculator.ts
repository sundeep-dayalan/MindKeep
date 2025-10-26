/**
 * Position Calculator
 *
 * Calculates optimal positioning for floating chat modal
 * based on input field position and available screen space.
 */

export interface Position {
  top: number
  left: number
  placement: 'top' | 'bottom' | 'left' | 'right'
}

export interface Dimensions {
  width: number
  height: number
}

/**
 * Calculate the best position for the chat modal relative to an input field
 * Takes into account screen boundaries to ensure modal is fully visible
 */
export function calculateModalPosition(
  inputElement: HTMLElement,
  modalDimensions: Dimensions
): Position {
  const inputRect = inputElement.getBoundingClientRect()
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  }

  const SPACING = 12 // Gap between input and modal
  const EDGE_PADDING = 16 // Minimum distance from screen edges

  // Calculate available space in each direction
  const spaceAbove = inputRect.top
  const spaceBelow = viewport.height - inputRect.bottom
  const spaceLeft = inputRect.left
  const spaceRight = viewport.width - inputRect.right

  console.log('📐 [PositionCalculator] Available space:', {
    above: spaceAbove,
    below: spaceBelow,
    left: spaceLeft,
    right: spaceRight,
    viewport,
    inputRect: {
      top: inputRect.top,
      bottom: inputRect.bottom,
      left: inputRect.left,
      right: inputRect.right
    }
  })

  // Determine primary placement (prefer right > bottom > left > top)
  let placement: 'top' | 'bottom' | 'left' | 'right'
  let top: number
  let left: number

  // Priority 1: Try placing to the RIGHT of input
  if (spaceRight >= modalDimensions.width + SPACING + EDGE_PADDING) {
    placement = 'right'
    left = inputRect.right + SPACING
    top = inputRect.top

    // Adjust vertically to keep modal on screen
    if (top + modalDimensions.height > viewport.height - EDGE_PADDING) {
      top = viewport.height - modalDimensions.height - EDGE_PADDING
    }
    if (top < EDGE_PADDING) {
      top = EDGE_PADDING
    }
  }
  // Priority 2: Try placing BELOW input
  else if (spaceBelow >= modalDimensions.height + SPACING + EDGE_PADDING) {
    placement = 'bottom'
    top = inputRect.bottom + SPACING
    left = inputRect.left

    // Adjust horizontally to keep modal on screen
    if (left + modalDimensions.width > viewport.width - EDGE_PADDING) {
      left = viewport.width - modalDimensions.width - EDGE_PADDING
    }
    if (left < EDGE_PADDING) {
      left = EDGE_PADDING
    }
  }
  // Priority 3: Try placing to the LEFT of input
  else if (spaceLeft >= modalDimensions.width + SPACING + EDGE_PADDING) {
    placement = 'left'
    left = inputRect.left - modalDimensions.width - SPACING
    top = inputRect.top

    // Adjust vertically to keep modal on screen
    if (top + modalDimensions.height > viewport.height - EDGE_PADDING) {
      top = viewport.height - modalDimensions.height - EDGE_PADDING
    }
    if (top < EDGE_PADDING) {
      top = EDGE_PADDING
    }
  }
  // Priority 4: Try placing ABOVE input
  else if (spaceAbove >= modalDimensions.height + SPACING + EDGE_PADDING) {
    placement = 'top'
    top = inputRect.top - modalDimensions.height - SPACING
    left = inputRect.left

    // Adjust horizontally to keep modal on screen
    if (left + modalDimensions.width > viewport.width - EDGE_PADDING) {
      left = viewport.width - modalDimensions.width - EDGE_PADDING
    }
    if (left < EDGE_PADDING) {
      left = EDGE_PADDING
    }
  }
  // Fallback: Center modal on screen if no good placement found
  else {
    console.warn(
      '⚠️  [PositionCalculator] Insufficient space in all directions, centering modal'
    )
    placement = 'bottom' // Arbitrary
    left = Math.max(EDGE_PADDING, (viewport.width - modalDimensions.width) / 2)
    top = Math.max(EDGE_PADDING, (viewport.height - modalDimensions.height) / 2)
  }

  console.log('✅ [PositionCalculator] Calculated position:', { placement, top, left })

  return { top, left, placement }
}

/**
 * Calculate position for the injected icon within an input field
 * Places icon in the bottom-right corner (like Grammarly)
 */
export function calculateIconPosition(inputElement: HTMLElement): { top: string; right: string } {
  // For standard inputs, use absolute positioning within the input
  // Icon should be in bottom-right corner with some padding

  const PADDING = 8 // pixels from edge

  return {
    top: 'auto',
    right: `${PADDING}px`
  }
}

/**
 * Update modal position when window is resized or scrolled
 */
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

  // Update on scroll and resize
  window.addEventListener('scroll', updatePosition, true) // Use capture for better tracking
  window.addEventListener('resize', updatePosition)

  // Initial position
  updatePosition()

  // Return cleanup function
  return () => {
    window.removeEventListener('scroll', updatePosition, true)
    window.removeEventListener('resize', updatePosition)
  }
}
