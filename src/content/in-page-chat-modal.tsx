import React, { useEffect, useRef, useState, type CSSProperties } from "react"

import { AISearchBar } from "~components/AISearchBar"
import type { AgentResponse } from "~services/langchain-agent"
import { getGlobalAgent } from "~services/langchain-agent"
import { logger } from "~utils/logger"

interface InPageChatModalProps {
  position: { top: number; left: number }
  onClose: () => void
  onInsert?: (text: string) => void
}

export function InPageChatModal({
  position,
  onClose,
  onInsert
}: InPageChatModalProps) {
  const [currentPosition, setCurrentPosition] = useState(position)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [onClose])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setCurrentPosition({
          top: e.clientY - dragOffset.y,
          left: e.clientX - dragOffset.x
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragOffset])

  const handleDragStart = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const isInteractive =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "BUTTON" ||
      target.closest("button") ||
      target.closest(".ProseMirror") ||
      target.closest('[contenteditable="true"]') ||
      target.hasAttribute("contenteditable")

    if (isInteractive) {
      return
    }

    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
      setIsDragging(true)
    }
  }

  const handleAISearch = async (
    query: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    onStreamChunk?: (chunk: string) => void
  ): Promise<string | AgentResponse> => {
    const startTime = performance.now()

    try {
      logger.log("💬 [In-Page Chat] Processing query:", query)

      const agent = await getGlobalAgent()

      if (onStreamChunk) {
        logger.log("💬 [In-Page Chat] Using streaming mode")

        let finalResponse: AgentResponse | null = null

        for await (const event of agent.runStream(query, conversationHistory)) {
          if (event.type === "chunk") {
            onStreamChunk(event.data as string)
          } else if (event.type === "complete") {
            finalResponse = event.data as AgentResponse
          }
        }

        const totalTime = performance.now() - startTime
        logger.log(
          `💬 [In-Page Chat] TOTAL stream time: ${totalTime.toFixed(2)}ms`
        )

        return (
          finalResponse || {
            aiResponse: "",
            extractedData: null,
            referenceNotes: []
          }
        )
      }

      const response = await agent.run(query, conversationHistory)

      const totalTime = performance.now() - startTime
      logger.log(`💬 [In-Page Chat] TOTAL time: ${totalTime.toFixed(2)}ms`)

      return response
    } catch (error) {
      const totalTime = performance.now() - startTime
      logger.error(
        `💬 [In-Page Chat] Failed after ${totalTime.toFixed(2)}ms:`,
        error
      )
      return "I encountered an error while searching. Please try again."
    }
  }

  const containerStyle: CSSProperties = {
    position: "fixed",
    top: `${currentPosition.top}px`,
    left: `${currentPosition.left}px`,
    zIndex: 2147483647,
    pointerEvents: "auto",
    width: "450px",
    maxHeight: "600px",
    cursor: isDragging ? "grabbing" : "default"
  }

  return (
    <div ref={modalRef} style={containerStyle} onMouseDown={handleDragStart}>
      <div
        style={{
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "16px",
          boxShadow:
            "0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(226, 232, 240, 0.5)",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "visible",
          border: "1px solid rgba(255, 255, 255, 0.3)"
        }}>
        {}
        <div style={{ flex: 1, overflow: "visible", padding: "16px" }}>
          <AISearchBar
            placeholder="Ask me anything..."
            onSearch={handleAISearch}
            maxInputHeight="2.5em"
            personaDropdownUpward={false}
            enableInsertMode={!!onInsert}
            onInsert={onInsert}
          />
        </div>
      </div>
    </div>
  )
}
