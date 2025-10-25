/**
 * CategorySuggestions Component
 *
 * Displays AI-suggested relevant categories as clickable chips
 * to help users quickly assign categories to notes.
 *
 * Usage:
 * <CategorySuggestions
 * noteTitle="My AI Research"
 * noteContent="Notes about Gemini Nano..."
 * availableCategories={["AI", "Research", "Work"]}
 * onCategorySelect={(category) => handleSelectCategory(category)}
 * excludeCategories={["AI"]} // Optional: categories already assigned
 * />
 */

import { useEffect, useRef, useState } from "react"

import { getRelevantCategories } from "~services/ai-service"
import type { ScoredCategory } from "~types/response"

interface CategorySuggestionsProps {
  /** The title of the note to analyze */
  noteTitle: string
  /** The content of the note to analyze */
  noteContent: string
  /** List of all available categories to suggest from */
  availableCategories: string[]
  /** Callback when user clicks a suggested category */
  onCategorySelect: (category: string) => void
  /** Optional: categories already assigned (will be excluded from suggestions) */
  excludeCategories?: string[]
  /** Optional: minimum relevance score to display (0.0 - 1.0, default: 0) */
  minRelevanceScore?: number
  /** Optional: maximum number of suggestions to show (default: 3) */
  maxSuggestions?: number
  /** Optional: custom class name for styling */
  className?: string
}

export function CategorySuggestions({
  noteTitle,
  noteContent,
  availableCategories,
  onCategorySelect,
  excludeCategories = [],
  minRelevanceScore = 0,
  maxSuggestions = 3,
  className = ""
}: CategorySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<ScoredCategory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use refs to hold the latest values without causing re-renders
  const availableCategoriesRef = useRef(availableCategories)
  const excludeCategoriesRef = useRef(excludeCategories)
  const minRelevanceScoreRef = useRef(minRelevanceScore)
  const maxSuggestionsRef = useRef(maxSuggestions)

  // Update refs when props change
  useEffect(() => {
    availableCategoriesRef.current = availableCategories
  }, [availableCategories])

  useEffect(() => {
    excludeCategoriesRef.current = excludeCategories
  }, [excludeCategories])

  useEffect(() => {
    minRelevanceScoreRef.current = minRelevanceScore
  }, [minRelevanceScore])

  useEffect(() => {
    maxSuggestionsRef.current = maxSuggestions
  }, [maxSuggestions])

  useEffect(() => {
    let isMounted = true

    const fetchSuggestions = async () => {
      // Don't fetch if there's no content to analyze
      if (!noteTitle.trim() && !noteContent.trim()) {
        setSuggestions([])
        return
      }

      // Don't fetch if there are no available categories
      if (availableCategoriesRef.current.length === 0) {
        setSuggestions([])
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const results = await getRelevantCategories(
          noteTitle,
          noteContent,
          availableCategoriesRef.current
        )

        if (!isMounted) return

        // Filter out already assigned categories and low-scoring suggestions
        // Remove duplicates by creating a Map with category as key
        const uniqueCategories = new Map<string, ScoredCategory>()

        results.forEach((item) => {
          const categoryLower = item.category.toLowerCase()
          // Only keep the highest scoring version of each category
          if (
            !excludeCategoriesRef.current
              .map((c) => c.toLowerCase())
              .includes(categoryLower) &&
            item.relevanceScore >= minRelevanceScoreRef.current &&
            (!uniqueCategories.has(categoryLower) ||
              uniqueCategories.get(categoryLower)!.relevanceScore <
                item.relevanceScore)
          ) {
            uniqueCategories.set(categoryLower, item)
          }
        })

        const filteredResults = Array.from(uniqueCategories.values()).slice(
          0,
          maxSuggestionsRef.current
        )

        setSuggestions(filteredResults)
      } catch (err) {
        if (!isMounted) return
        console.error("Error fetching category suggestions:", err)
        setError("Could not fetch suggestions")
        setSuggestions([])
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    // Debounce the fetch to avoid too many calls while typing
    const timeoutId = setTimeout(fetchSuggestions, 500)

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [
    noteTitle,
    noteContent
    // ONLY noteTitle and noteContent trigger re-fetch
    // Other props are accessed via refs to avoid unnecessary re-renders
  ])

  const handleCategoryClick = (category: string) => {
    // Hide the clicked suggestion immediately
    setSuggestions((prevSuggestions) =>
      prevSuggestions.filter((item) => item.category !== category)
    )
    onCategorySelect(category)
  }

  // Don't render anything if there are no suggestions
  if (!isLoading && suggestions.length === 0 && !error) {
    return null
  }

  return (
    <div className={`category-suggestions ${className}`}>
      {isLoading && (
        <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-text-sm plasmo-text-gray-500">
          <div className="plasmo-animate-spin plasmo-h-4 plasmo-w-4 plasmo-border-2 plasmo-border-blue-500 plasmo-border-t-transparent plasmo-rounded-full"></div>
          <span>Finding relevant categories...</span>
        </div>
      )}

      {error && (
        <div className="plasmo-text-sm plasmo-text-red-500">{error}</div>
      )}

      {!isLoading && suggestions.length > 0 && (
        <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-overflow-x-auto plasmo-no-visible-scrollbar">
          <div className="plasmo-flex plasmo-gap-2 plasmo-flex-nowrap">
            {suggestions.map((item) => (
              <button
                key={item.category}
                onClick={() => handleCategoryClick(item.category)}
                className="plasmo-inline-flex plasmo-items-center plasmo-gap-1.5 plasmo-px-3 plasmo-py-1.5 plasmo-bg-gradient-to-r plasmo-from-blue-50 plasmo-to-indigo-50 hover:plasmo-from-blue-100 hover:plasmo-to-indigo-100 plasmo-text-blue-700 plasmo-rounded-full plasmo-text-sm plasmo-font-medium plasmo-transition-all plasmo-duration-200 plasmo-border plasmo-border-blue-200 hover:plasmo-border-blue-300 hover:plasmo-shadow-sm plasmo-cursor-pointer plasmo-whitespace-nowrap plasmo-flex-shrink-0"
                title={`Click to assign "${item.category}" category`}>
                <svg
                  className="plasmo-w-3.5 plasmo-h-3.5 plasmo-text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                <span>{item.category}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default CategorySuggestions
