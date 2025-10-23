import { useState } from "react"

import { AnimatedShinyText } from "./ui/AnimatedShinyText"
import { HoverBorderGradient } from "./ui/hover-border-gradient"

interface HeaderProps {
  onClose: () => void
  onPersonasClick?: () => void
  onCreateNote?: () => void
  view?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  onSearchClear?: () => void
}

export function Header({
  onClose,
  onPersonasClick,
  onCreateNote,
  view,
  searchValue = "",
  onSearchChange,
  onSearchClear
}: HeaderProps) {
  const [searchExpanded, setSearchExpanded] = useState(false)

  const handleSearchClick = () => {
    setSearchExpanded(true)
  }

  const handleSearchClose = () => {
    setSearchExpanded(false)
    if (onSearchClear) {
      onSearchClear()
    }
  }

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSearchChange) {
      onSearchChange(e.target.value)
    }
  }

  return (
    <div className="plasmo-bg-gradient-to-r plasmo-from-sky-100 plasmo-via-indigo-50 plasmo-to-white plasmo-border-b plasmo-border-slate-200 plasmo-p-4">
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-gap-2">
        {/* Left: Logo */}
        <AnimatedShinyText className="plasmo-text-xl plasmo-inline-flex plasmo-items-center plasmo-justify-center plasmo-px-4 plasmo-py-1 plasmo-transition plasmo-ease-out plasmo-hover:text-neutral-600 plasmo-hover:duration-300 plasmo-hover:dark:text-neutral-400">
          MindKeep 🧠
        </AnimatedShinyText>

        {/* Center/Right: Search, Personas, Close */}
        <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-flex-1 plasmo-justify-end">
          {/* Collapsible Search Bar - only show in list view */}
          {view === "list" && (
            <div
              className={`plasmo-flex plasmo-items-center plasmo-transition-all plasmo-duration-300 ${
                searchExpanded
                  ? "plasmo-flex-1 plasmo-max-w-md"
                  : "plasmo-w-auto"
              }`}>
              {searchExpanded ? (
                <div className="plasmo-relative plasmo-w-full">
                  <svg
                    className="plasmo-w-4 plasmo-h-4 plasmo-absolute plasmo-left-3 plasmo-top-1/2 plasmo-transform -plasmo-translate-y-1/2 plasmo-text-slate-400 plasmo-pointer-events-none"
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
                    value={searchValue}
                    onChange={handleSearchInput}
                    placeholder="Search notes..."
                    autoFocus
                    className="plasmo-w-full plasmo-pl-10 plasmo-pr-10 plasmo-py-2 plasmo-border plasmo-border-slate-300 plasmo-rounded-lg plasmo-text-sm plasmo-bg-white focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-100 focus:plasmo-border-blue-100 plasmo-transition-all"
                  />
                  <button
                    onClick={handleSearchClose}
                    className="plasmo-absolute plasmo-right-3 plasmo-top-1/2 plasmo-transform -plasmo-translate-y-1/2 plasmo-text-slate-400 hover:plasmo-text-slate-600 plasmo-transition-colors plasmo-p-0.5"
                    title="Close search">
                    <svg
                      className="plasmo-w-4 plasmo-h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSearchClick}
                  className="plasmo-p-2 plasmo-rounded-lg plasmo-text-slate-500 hover:plasmo-text-slate-900 hover:plasmo-bg-slate-100 plasmo-transition-colors"
                  title="Search notes">
                  <svg
                    className="plasmo-w-5 plasmo-h-5"
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
                </button>
              )}
            </div>
          )}

          {/* Create Note Button - only show in list view when search not expanded */}
          {view === "list" && onCreateNote && !searchExpanded && (
            <HoverBorderGradient
              onClick={onCreateNote}
              containerClassName="rounded-full"
              as="button"
              className="plasmo-dark:bg-black plasmo-bg-blue-300  plasmo-text-white plasmo-dark:text-white flex plasmo-items-center plasmo-space-x-2">
              <svg
                className="plasmo-w-4 plasmo-h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>New Note</span>
            </HoverBorderGradient>
          )}

          {/* Personas Management Button - show in all views except when search is expanded */}
          {onPersonasClick && !searchExpanded && (
            <button
              onClick={onPersonasClick}
              className={`plasmo-px-3 plasmo-py-1.5 plasmo-rounded-lg plasmo-text-sm plasmo-font-medium plasmo-transition-colors plasmo-flex-shrink-0 ${
                view === "personas"
                  ? "plasmo-bg-purple-600 plasmo-text-white"
                  : "plasmo-bg-slate-100 plasmo-text-slate-700 hover:plasmo-bg-slate-200"
              }`}
              title="Manage Personas">
              🎭
            </button>
          )}

          {/* Close Button - always show when search not expanded */}
          {!searchExpanded && (
            <button
              onClick={onClose}
              className="plasmo-p-2 plasmo-rounded-lg plasmo-text-slate-500 hover:plasmo-text-slate-900 hover:plasmo-bg-slate-100 plasmo-transition-colors plasmo-flex-shrink-0"
              title="Close">
              <svg
                className="plasmo-w-5 plasmo-h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
