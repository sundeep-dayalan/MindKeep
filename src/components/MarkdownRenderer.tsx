

import { marked } from "marked"
import { useEffect, useRef } from "react"

import "./markdown.css"

interface MarkdownRendererProps {
  content: string
  className?: string
}

marked.setOptions({
  breaks: true,
  gfm: true
})

export function MarkdownRenderer({
  content,
  className = ""
}: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      const html = marked.parse(content) as string
      containerRef.current.innerHTML = html
    }
  }, [content])

  return (
    <div
      ref={containerRef}
      className={`plasmo-markdown-content ${className}`}
      style={{

        fontSize: "0.875rem",
        lineHeight: "1.5",
        color: "#334155"
      }}
    />
  )
}
