import React, { useCallback, useEffect, useState } from "react"
import Joyride, {
  ACTIONS,
  CallBackProps,
  EVENTS,
  STATUS,
  type Step
} from "react-joyride"

import { logger } from "~utils/logger"

interface TourGuideProps {
  steps: Step[]
  run: boolean
  onComplete?: () => void
  onSkip?: () => void
  continuous?: boolean
  showProgress?: boolean
  showSkipButton?: boolean
  scrollOffset?: number
  disableScrolling?: boolean
}

/**
 * TourGuide component wraps react-joyride with custom styling
 * that matches MindKeep's design system
 */
export function TourGuide({
  steps,
  run,
  onComplete,
  onSkip,
  continuous = true,
  showProgress = true,
  showSkipButton = true,
  scrollOffset = 20,
  disableScrolling = false
}: TourGuideProps) {
  useEffect(() => {
    if (run) {
      logger.log("🎯 [Tour] Starting tour with", steps.length, "steps")
    }
  }, [run, steps.length])

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { action, index, status, type } = data

      logger.log(
        `🎯 [Tour] Event: ${type}, Status: ${status}, Action: ${action}, Step: ${index + 1}/${steps.length}`
      )

      if (status === STATUS.FINISHED) {
        logger.log("🎯 [Tour] Completed successfully")
        if (onComplete) {
          onComplete()
        }
      } else if (status === STATUS.SKIPPED) {
        logger.log("🎯 [Tour] Skipped by user")
        if (onSkip) {
          onSkip()
        }
      }

      // Log when target is not found
      if (type === EVENTS.TARGET_NOT_FOUND) {
        logger.warn(
          `🎯 [Tour] Target not found for step ${index + 1}:`,
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
      continuous={continuous}
      showProgress={showProgress}
      showSkipButton={showSkipButton}
      scrollOffset={scrollOffset}
      disableScrolling={disableScrolling}
      callback={handleJoyrideCallback}
      scrollToFirstStep={true}
      disableOverlayClose={false}
      spotlightClicks={true}
      spotlightPadding={8}
      styles={{
        options: {
          arrowColor: "#ffffff",
          backgroundColor: "#ffffff",
          overlayColor: "rgba(0, 0, 0, 0.6)",
          primaryColor: "#3b82f6",
          textColor: "#0f172a",
          width: 380,
          zIndex: 10000
        },
        tooltip: {
          borderRadius: "16px",
          padding: "20px",
          boxShadow:
            "0 20px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(226, 232, 240, 0.3)"
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
          backgroundColor: "rgba(0, 0, 0, 0.6)"
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
        last: "Finish",
        next: "Next",
        nextLabelWithProgress: "Next ({step} of {steps})",
        open: "Open",
        skip: "Skip tour"
      }}
    />
  )
}

/**
 * Hook to manage tour state in localStorage
 */
export function useTourState(tourKey: string) {
  const [hasCompletedTour, setHasCompletedTour] = useState<boolean>(() => {
    try {
      const completed = localStorage.getItem(`mindkeep_tour_${tourKey}`)
      return completed === "true"
    } catch (error) {
      logger.error("Error reading tour state from localStorage:", error)
      return false
    }
  })

  const [runTour, setRunTour] = useState(false)

  const startTour = useCallback(() => {
    logger.log(`🎯 [Tour] Starting ${tourKey} tour (manual trigger or auto-start)`)
    setRunTour(true)
  }, [tourKey])

  const completeTour = useCallback(() => {
    logger.log(`🎯 [Tour] Marking ${tourKey} tour as completed`)
    try {
      localStorage.setItem(`mindkeep_tour_${tourKey}`, "true")
      setHasCompletedTour(true)
      setRunTour(false)
    } catch (error) {
      logger.error("Error saving tour state to localStorage:", error)
    }
  }, [tourKey])

  const skipTour = useCallback(() => {
    logger.log(`🎯 [Tour] Skipping ${tourKey} tour`)
    setRunTour(false)
  }, [tourKey])

  const resetTour = useCallback(() => {
    logger.log(`🎯 [Tour] Resetting ${tourKey} tour`)
    try {
      localStorage.removeItem(`mindkeep_tour_${tourKey}`)
      setHasCompletedTour(false)
    } catch (error) {
      logger.error("Error resetting tour state in localStorage:", error)
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
