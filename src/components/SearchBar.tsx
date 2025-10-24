interface SearchBarProps {
 value: string
 onChange: (value: string) => void
 onClear: () => void
 onSearch: () => void
 placeholder?: string
}

export function SearchBar({
 value,
 onChange,
 onClear,
 onSearch,
 placeholder = "Search notes..."
}: SearchBarProps) {
 return (
 <div className="plasmo-relative">
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
 value={value}
 onChange={(e) => onChange(e.target.value)}
 onKeyDown={(e) => e.key === "Enter" && onSearch()}
 placeholder={placeholder}
 className="plasmo-w-full plasmo-pl-10 plasmo-pr-10 plasmo-py-2.5 plasmo-border plasmo-border-slate-300 plasmo-rounded-lg plasmo-text-sm plasmo-bg-white focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500 plasmo-transition-all"
 />
 {value && (
 <button
 onClick={onClear}
 className="plasmo-absolute plasmo-right-3 plasmo-top-1/2 plasmo-transform -plasmo-translate-y-1/2 plasmo-text-slate-400 hover:plasmo-text-slate-600 plasmo-transition-colors plasmo-p-0.5"
 title="Clear search">
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
 )}
 </div>
 )
}
