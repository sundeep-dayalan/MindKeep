import React from "react"

interface AISearchBarProps {
  placeholder?: string
  onSearch?: (query: string) => void
  className?: string
}

export function AISearchBar({
  placeholder = "Ask me anything...",
  onSearch,
  className = ""
}: AISearchBarProps) {
  const [query, setQuery] = React.useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim() && onSearch) {
      onSearch(query.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className={`plasmo-space-y-2 ${className}`}>
      {/* Ask AI Label */}
      <div className="plasmo-flex plasmo-items-center plasmo-gap-1.5 plasmo-px-1">
        <svg
          className="plasmo-w-4 plasmo-h-4 plasmo-text-slate-600"
          fill="currentColor"
          viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span className="plasmo-text-xs plasmo-font-medium plasmo-text-slate-600">
          Ask AI
        </span>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSubmit}>
        <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-bg-slate-50 plasmo-rounded-full plasmo-px-4 plasmo-py-3 plasmo-border plasmo-border-slate-200 hover:plasmo-border-slate-300 plasmo-transition-all focus-within:plasmo-border-blue-400 focus-within:plasmo-ring-2 focus-within:plasmo-ring-blue-100">
          <svg
            className="plasmo-w-5 plasmo-h-5 plasmo-text-slate-400 plasmo-flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="plasmo-flex-1 plasmo-bg-transparent plasmo-border-none plasmo-outline-none plasmo-text-slate-700 placeholder:plasmo-text-slate-400 plasmo-text-sm"
          />
          <button
            type="submit"
            className="plasmo-flex-shrink-0 plasmo-w-8 plasmo-h-8 plasmo-bg-slate-900 plasmo-text-white plasmo-rounded-full plasmo-flex plasmo-items-center plasmo-justify-center hover:plasmo-bg-slate-800 plasmo-transition-colors disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed"
            title="Send"
            disabled={!query.trim()}>
            <svg
              className="plasmo-w-4 plasmo-h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}
