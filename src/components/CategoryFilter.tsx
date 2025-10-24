import { useState } from "react"

interface CategoryFilterProps {
 categories: string[]
 selectedCategory: string
 onCategoryChange: (category: string) => void
}

export function CategoryFilter({
 categories,
 selectedCategory,
 onCategoryChange
}: CategoryFilterProps) {
 const [isExpanded, setIsExpanded] = useState(false)
 const [searchQuery, setSearchQuery] = useState("")

 const filteredCategories = categories.filter((cat) =>
 cat.toLowerCase().includes(searchQuery.toLowerCase())
 )

 const handleCategorySelect = (category: string) => {
 onCategoryChange(category)
 setSearchQuery("")
 setIsExpanded(false)
 }

 return (
 <div className="plasmo-bg-white plasmo-border plasmo-border-slate-200 plasmo-rounded-lg plasmo-overflow-hidden">
 {/* Header - Always Visible */}
 <button
 onClick={() => setIsExpanded(!isExpanded)}
 className="plasmo-w-full plasmo-p-3 plasmo-flex plasmo-items-center plasmo-justify-between hover:plasmo-bg-slate-50 plasmo-transition-colors">
 <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
 <h3 className="plasmo-text-xs plasmo-font-semibold plasmo-text-slate-500 plasmo-uppercase plasmo-tracking-wide">
 Categories
 </h3>
 <span className="plasmo-inline-flex plasmo-items-center plasmo-justify-center plasmo-min-w-[20px] plasmo-h-5 plasmo-px-1.5 plasmo-bg-slate-100 plasmo-text-slate-700 plasmo-text-xs plasmo-font-medium plasmo-rounded">
 {categories.length}
 </span>
 </div>
 <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
 <span className="plasmo-inline-flex plasmo-items-center plasmo-gap-1.5 plasmo-px-3 plasmo-py-1.5 plasmo-bg-slate-900 plasmo-text-white plasmo-rounded-full plasmo-text-xs plasmo-font-medium plasmo-shadow-sm plasmo-capitalize plasmo-max-w-[140px] plasmo-truncate">
 <svg
 className="plasmo-w-3.5 plasmo-h-3.5 plasmo-flex-shrink-0"
 fill="currentColor"
 viewBox="0 0 20 20">
 <path
 fillRule="evenodd"
 d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
 clipRule="evenodd"
 />
 </svg>
 <span className="plasmo-truncate">
 {selectedCategory === "all" ? "All" : selectedCategory}
 </span>
 </span>
 <svg
 className={`plasmo-w-4 plasmo-h-4 plasmo-text-slate-500 plasmo-transition-transform plasmo-duration-200 plasmo-flex-shrink-0 ${
 isExpanded ? "plasmo-rotate-180" : ""
 }`}
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24">
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M19 9l-7 7-7-7"
 />
 </svg>
 </div>
 </button>

 {/* Expandable Content */}
 {isExpanded && (
 <div className="plasmo-border-t plasmo-border-slate-200 plasmo-p-3 plasmo-pt-2">
 {/* Category Search (only show if more than 10 categories) */}
 {categories.length > 10 && (
 <div className="plasmo-mb-2">
 <div className="plasmo-relative">
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Search categories..."
 className="plasmo-w-full plasmo-px-3 plasmo-py-1.5 plasmo-pl-8 plasmo-text-xs plasmo-border plasmo-border-slate-200 plasmo-rounded-md focus:plasmo-outline-none focus:plasmo-ring-1 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
 />
 <svg
 className="plasmo-w-3.5 plasmo-h-3.5 plasmo-absolute plasmo-left-2.5 plasmo-top-1/2 plasmo-transform -plasmo-translate-y-1/2 plasmo-text-slate-400"
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
 {searchQuery && (
 <button
 onClick={() => setSearchQuery("")}
 className="plasmo-absolute plasmo-right-2 plasmo-top-1/2 plasmo-transform -plasmo-translate-y-1/2 plasmo-text-slate-400 hover:plasmo-text-slate-600">
 <svg
 className="plasmo-w-3.5 plasmo-h-3.5"
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
 )}

 {/* Scrollable Category Pills Container */}
 <div
 className="plasmo-overflow-y-auto"
 style={{
 maxHeight: "150px"
 }}>
 <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2">
 <button
 onClick={() => handleCategorySelect("all")}
 className={`plasmo-inline-flex plasmo-items-center plasmo-gap-1.5 plasmo-px-3 plasmo-py-1.5 plasmo-rounded-full plasmo-text-xs plasmo-font-medium plasmo-transition-all plasmo-duration-200 plasmo-flex-shrink-0 ${
 selectedCategory === "all"
 ? "plasmo-bg-slate-900 plasmo-text-white plasmo-shadow-sm"
 : "plasmo-bg-slate-100 plasmo-text-slate-700 hover:plasmo-bg-slate-200"
 }`}>
 {selectedCategory === "all" && (
 <svg
 className="plasmo-w-3.5 plasmo-h-3.5"
 fill="currentColor"
 viewBox="0 0 20 20">
 <path
 fillRule="evenodd"
 d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
 clipRule="evenodd"
 />
 </svg>
 )}
 <span>All</span>
 </button>
 {filteredCategories.length === 0 ? (
 <div className="plasmo-text-xs plasmo-text-slate-400 plasmo-py-1">
 No categories found
 </div>
 ) : (
 filteredCategories.map((cat) => (
 <button
 key={cat}
 onClick={() => handleCategorySelect(cat)}
 className={`plasmo-inline-flex plasmo-items-center plasmo-gap-1.5 plasmo-px-3 plasmo-py-1.5 plasmo-rounded-full plasmo-text-xs plasmo-font-medium plasmo-transition-all plasmo-duration-200 plasmo-capitalize plasmo-flex-shrink-0 ${
 selectedCategory === cat
 ? "plasmo-bg-slate-900 plasmo-text-white plasmo-shadow-sm"
 : "plasmo-bg-slate-100 plasmo-text-slate-700 hover:plasmo-bg-slate-200"
 }`}>
 {selectedCategory === cat && (
 <svg
 className="plasmo-w-3.5 plasmo-h-3.5"
 fill="currentColor"
 viewBox="0 0 20 20">
 <path
 fillRule="evenodd"
 d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
 clipRule="evenodd"
 />
 </svg>
 )}
 <span>{cat}</span>
 </button>
 ))
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
