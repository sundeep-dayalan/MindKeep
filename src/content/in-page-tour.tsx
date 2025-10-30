import React, { useCallback, useEffect } from "react"
import Joyride, {
  ACTIONS,
  CallBackProps,
  EVENTS,
  STATUS,
  type Step
} from "react-joyride"

import { logger } from "~utils/logger"

interface InPageTourProps {
  steps: Step[]
  run: boolean
  onComplete?: () => void
  onSkip?: () => void
}

/**
 * Simplified TourGuide for content scripts / in-page modal
 * Similar to TourGuide but optimized for content script environment
 */
export function InPageTour({
  steps,
  run,
  onComplete,
  onSkip
}: InPageTourProps) {
  useEffect(() => {
    if (run) {
      logger.log("🎯 [In-Page Tour] Starting tour with", steps.length, "steps")
    }
  }, [run, steps.length])

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { action, index, status, type } = data

      logger.log(
        `🎯 [In-Page Tour] Event: ${type}, Status: ${status}, Action: ${action}, Step: ${index + 1}/${steps.length}`
      )

      if (status === STATUS.FINISHED) {
        logger.log("🎯 [In-Page Tour] Completed successfully")
        if (onComplete) {
          onComplete()
        }
      } else if (status === STATUS.SKIPPED) {
        logger.log("🎯 [In-Page Tour] Skipped by user")
        if (onSkip) {
          onSkip()
        }
      }

      // Log when target is not found
      if (type === EVENTS.TARGET_NOT_FOUND) {
        logger.warn(
          `🎯 [In-Page Tour] Target not found for step ${index + 1}:`,
          steps[index]?.target
        )
      }
    },
    [steps, onComplete, onSkip]
  )

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      showProgress={true}
      showSkipButton={true}
      scrollOffset={20}
      disableScrolling={false}
      callback={handleJoyrideCallback}
      scrollToFirstStep={false}
      disableOverlay={true}
      disableOverlayClose={true}
      spotlightClicks={true}
      spotlightPadding={10}
      styles={{
        options: {
          arrowColor: "#ffffff",
          backgroundColor: "#ffffff",
          overlayColor: "rgba(0, 0, 0, 0)",
          primaryColor: "#3b82f6",
          textColor: "#0f172a",
          width: 360,
          zIndex: 2147483647 // Max z-index for content scripts
        },
        tooltip: {
          borderRadius: "16px",
          padding: "20px",
          boxShadow:
            "0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(226, 232, 240, 0.3)"
        },
        tooltipContainer: {
          textAlign: "left"
        },
        tooltipTitle: {
          fontSize: "18px",
          fontWeight: "700",
          color: "#0f172a",
          marginBottom: "8px"
        },
        tooltipContent: {
          fontSize: "14px",
          lineHeight: "1.6",
          color: "#475569",
          padding: "8px 0"
        },
        buttonNext: {
          backgroundColor: "#3b82f6",
          borderRadius: "8px",
          color: "#ffffff",
          fontSize: "14px",
          fontWeight: "600",
          padding: "10px 20px",
          transition: "all 0.2s ease",
          border: "none",
          cursor: "pointer"
        },
        buttonBack: {
          color: "#64748b",
          fontSize: "14px",
          fontWeight: "600",
          marginRight: "12px",
          border: "none",
          backgroundColor: "transparent",
          cursor: "pointer"
        },
        buttonSkip: {
          color: "#94a3b8",
          fontSize: "13px",
          fontWeight: "500",
          border: "none",
          backgroundColor: "transparent",
          cursor: "pointer"
        },
        buttonClose: {
          display: "none" // Hide the close button - users must skip or complete
        },
        spotlight: {
          borderRadius: "8px",
          backgroundColor: "transparent"
        },
        overlay: {
          backgroundColor: "rgba(0, 0, 0, 0.7)"
        },
        beacon: {
          backgroundColor: "#3b82f6",
          borderRadius: "50%"
        },
        beaconInner: {
          backgroundColor: "#3b82f6"
        },
        beaconOuter: {
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          border: "2px solid #3b82f6"
        }
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Got it!",
        next: "Next",
        nextLabelWithProgress: "Next ({step} of {steps})",
        open: "Open",
        skip: "Skip tour"
      }}
    />
  )
}

/**
 * Hook to manage in-page tour state
 */
export function useInPageTourState(tourKey: string) {
  const [hasCompletedTour, setHasCompletedTour] = React.useState<boolean>(
    () => {
      try {
        const completed = localStorage.getItem(`mindkeep_inpage_tour_${tourKey}`)
        return completed === "true"
      } catch (error) {
        logger.error("Error reading in-page tour state:", error)
        return false
      }
    }
  )

  const [runTour, setRunTour] = React.useState(false)

  const startTour = useCallback(() => {
    logger.log(`🎯 [In-Page Tour] Starting ${tourKey} tour`)
    setRunTour(true)
  }, [tourKey])

  const completeTour = useCallback(() => {
    logger.log(`🎯 [In-Page Tour] Marking ${tourKey} tour as completed`)
    try {
      localStorage.setItem(`mindkeep_inpage_tour_${tourKey}`, "true")
      setHasCompletedTour(true)
      setRunTour(false)
    } catch (error) {
      logger.error("Error saving in-page tour state:", error)
    }
  }, [tourKey])

  const skipTour = useCallback(() => {
    logger.log(`🎯 [In-Page Tour] Skipping ${tourKey} tour`)
    try {
      localStorage.setItem(`mindkeep_inpage_tour_${tourKey}`, "true")
      setHasCompletedTour(true)
      setRunTour(false)
    } catch (error) {
      logger.error("Error saving in-page tour skip state:", error)
    }
  }, [tourKey])

  const resetTour = useCallback(() => {
    logger.log(`🎯 [In-Page Tour] Resetting ${tourKey} tour`)
    try {
      localStorage.removeItem(`mindkeep_inpage_tour_${tourKey}`)
      setHasCompletedTour(false)
    } catch (error) {
      logger.error("Error resetting in-page tour state:", error)
    }
  }, [tourKey])

  return {
    hasCompletedTour,
    runTour,
    startTour,
    completeTour,
    skipTour,
    resetTour
  }
}
