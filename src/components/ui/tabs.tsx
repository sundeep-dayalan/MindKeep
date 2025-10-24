"use client"

import { motion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"

type Tab = {
 title: string
 value: string
 count?: number
 content?: string | React.ReactNode | any
}

export const Tabs = ({
 tabs: propTabs,
 containerClassName,
 activeTabClassName,
 tabClassName,
 contentClassName,
 onTabChange
}: {
 tabs: Tab[]
 containerClassName?: string
 activeTabClassName?: string
 tabClassName?: string
 contentClassName?: string
 onTabChange?: (value: string) => void
}) => {
 const [active, setActive] = useState<Tab>(propTabs[0])
 const [tabs, setTabs] = useState<Tab[]>(propTabs)
 const [hovering, setHovering] = useState(false)
 const [canScrollLeft, setCanScrollLeft] = useState(false)
 const [canScrollRight, setCanScrollRight] = useState(false)
 const scrollContainerRef = useRef<HTMLDivElement>(null)

 // Create a map of tab values to their counts for quick lookup
 const tabCountMap = useMemo(() => {
 const map = new Map<string, number>()
 propTabs.forEach((tab) => {
 if (tab.count !== undefined) {
 map.set(tab.value, tab.count)
 }
 })
 return map
 }, [propTabs])

 // Update tabs when propTabs structure changes (add/remove tabs)
 // but preserve the order and just update counts
 useEffect(() => {
 setTabs((prevTabs) => {
 // If tab structure changed (different values), reset completely
 const prevValues = prevTabs
 .map((t) => t.value)
 .sort()
 .join(",")
 const newValues = propTabs
 .map((t) => t.value)
 .sort()
 .join(",")

 if (prevValues !== newValues) {
 setActive(propTabs[0])
 return propTabs
 }

 // Otherwise, update counts AND content while preserving order
 return prevTabs.map((tab) => {
 const matchingPropTab = propTabs.find((pt) => pt.value === tab.value)
 return matchingPropTab
 ? {
 ...tab,
 count: matchingPropTab.count,
 content: matchingPropTab.content
 }
 : tab
 })
 })
 }, [propTabs])

 const moveSelectedTabToTop = (idx: number) => {
 // Get the selected tab from propTabs with its current count
 const selectedTab = propTabs[idx]

 // Create new tabs array with selected tab first, preserving all counts
 const newTabs = [selectedTab, ...propTabs.filter((_, i) => i !== idx)]

 setTabs(newTabs)
 setActive(selectedTab)

 // Notify parent of tab change
 if (onTabChange && selectedTab) {
 onTabChange(selectedTab.value)
 }

 // Scroll the container to the start to show the newly selected tab
 setTimeout(() => {
 const container = scrollContainerRef.current
 if (container) {
 container.scrollTo({
 left: 0,
 behavior: "smooth"
 })
 }
 }, 50)
 }

 const checkScroll = () => {
 const container = scrollContainerRef.current
 if (!container) return

 const { scrollLeft, scrollWidth, clientWidth } = container
 setCanScrollLeft(scrollLeft > 0)
 setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
 }

 const scroll = (direction: "left" | "right") => {
 const container = scrollContainerRef.current
 if (!container) return

 const scrollAmount = 200
 container.scrollBy({
 left: direction === "left" ? -scrollAmount : scrollAmount,
 behavior: "smooth"
 })
 }

 useEffect(() => {
 checkScroll()
 const container = scrollContainerRef.current
 if (!container) return

 container.addEventListener("scroll", checkScroll)
 window.addEventListener("resize", checkScroll)

 return () => {
 container.removeEventListener("scroll", checkScroll)
 window.removeEventListener("resize", checkScroll)
 }
 }, [propTabs])

 return (
 <>
 {/* Sticky Tabs Header with matching padding */}
 <div className="plasmo-flex-shrink-0 plasmo-px-4 plasmo-pb-1">
 <div className="plasmo-relative plasmo-w-full">
 {/* Left Gradient & Arrow */}
 {canScrollLeft && (
 <div className="plasmo-absolute plasmo-left-0 plasmo-top-0 plasmo-bottom-0 plasmo-w-20 plasmo-z-10 plasmo-flex plasmo-items-center plasmo-pointer-events-none">
 <div className="plasmo-absolute plasmo-inset-0 plasmo-bg-gradient-to-r plasmo-from-slate-50 plasmo-via-slate-50/50 plasmo-to-transparent" />
 <button
 onClick={() => scroll("left")}
 className="plasmo-relative plasmo-ml-2 plasmo-w-8 plasmo-h-8 plasmo-rounded-full plasmo-bg-white plasmo-shadow-md plasmo-flex plasmo-items-center plasmo-justify-center plasmo-pointer-events-auto plasmo-transition-all hover:plasmo-bg-slate-100 hover:plasmo-shadow-lg">
 <svg
 className="plasmo-w-4 plasmo-h-4 plasmo-text-slate-700"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24">
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M15 19l-7-7 7-7"
 />
 </svg>
 </button>
 </div>
 )}

 {/* Right Gradient & Arrow */}
 {canScrollRight && (
 <div className="plasmo-absolute plasmo-right-0 plasmo-top-0 plasmo-bottom-0 plasmo-w-20 plasmo-z-10 plasmo-flex plasmo-items-center plasmo-justify-end plasmo-pointer-events-none">
 <div className="plasmo-absolute plasmo-inset-0 plasmo-bg-gradient-to-l plasmo-from-slate-50 plasmo-via-slate-50/50 plasmo-to-transparent" />
 <button
 onClick={() => scroll("right")}
 className="plasmo-relative plasmo-mr-2 plasmo-w-8 plasmo-h-8 plasmo-rounded-full plasmo-bg-white plasmo-shadow-md plasmo-flex plasmo-items-center plasmo-justify-center plasmo-pointer-events-auto plasmo-transition-all hover:plasmo-bg-slate-100 hover:plasmo-shadow-lg">
 <svg
 className="plasmo-w-4 plasmo-h-4 plasmo-text-slate-700"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24">
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M9 5l7 7-7 7"
 />
 </svg>
 </button>
 </div>
 )}

 {/* Tabs Container */}
 <div
 ref={scrollContainerRef}
 className={`plasmo-flex plasmo-flex-row plasmo-items-center plasmo-justify-start [perspective:1000px] plasmo-relative plasmo-overflow-x-auto plasmo-overflow-y-hidden plasmo-no-visible-scrollbar plasmo-max-w-full plasmo-w-full plasmo-gap-1 plasmo-p-1 plasmo-bg-slate-100/80 plasmo-rounded-full plasmo-backdrop-blur-sm ${containerClassName || ""}`}>
 {tabs.map((tab, idx) => (
 <button
 key={tab.value}
 onClick={() => {
 // Find the index in propTabs
 const propTabIndex = propTabs.findIndex(
 (t) => t.value === tab.value
 )
 moveSelectedTabToTop(propTabIndex)
 }}
 onMouseEnter={() => setHovering(true)}
 onMouseLeave={() => setHovering(false)}
 className={`plasmo-relative plasmo-px-4 plasmo-py-2.5 plasmo-rounded-full plasmo-transition-all plasmo-duration-200 plasmo-flex-shrink-0 ${tabClassName || ""}`}
 style={{
 transformStyle: "preserve-3d"
 }}>
 {active.value === tab.value && (
 <motion.div
 layoutId="clickedbutton"
 transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
 className={`plasmo-absolute plasmo-inset-0 plasmo-bg-slate-800 plasmo-rounded-full plasmo-shadow-lg ${activeTabClassName || ""}`}
 />
 )}

 <span
 className={`plasmo-relative plasmo-block plasmo-text-sm plasmo-font-semibold plasmo-capitalize plasmo-transition-colors plasmo-duration-200 plasmo-whitespace-nowrap plasmo-flex plasmo-items-center plasmo-gap-2 ${
 active.value === tab.value
 ? "plasmo-text-white"
 : "plasmo-text-slate-600 hover:plasmo-text-slate-800"
 }`}>
 {tab.title}
 {tab.count !== undefined && (
 <span
 className={`plasmo-inline-flex plasmo-items-center plasmo-justify-center plasmo-min-w-[20px] plasmo-h-5 plasmo-px-1.5 plasmo-text-xs plasmo-font-medium plasmo-rounded plasmo-transition-colors plasmo-duration-200 ${
 active.value === tab.value
 ? "plasmo-bg-white/20 plasmo-text-white"
 : "plasmo-bg-slate-200 plasmo-text-slate-700"
 }`}>
 {tab.count}
 </span>
 )}
 </span>
 </button>
 ))}
 </div>
 </div>
 </div>

 <FadeInDiv
 tabs={tabs}
 active={active}
 key={active.value}
 hovering={hovering}
 className={contentClassName}
 />
 </>
 )
}

export const FadeInDiv = ({
 className,
 tabs,
 hovering
}: {
 className?: string
 key?: string
 tabs: Tab[]
 active: Tab
 hovering?: boolean
}) => {
 const isActive = (tab: Tab) => {
 return tab.value === tabs[0].value
 }
 return (
 <div className="plasmo-relative plasmo-w-full plasmo-flex-1 plasmo-overflow-hidden">
 {tabs.map((tab, idx) => (
 <motion.div
 key={tab.value}
 layoutId={tab.value}
 style={{
 scale: 1 - idx * 0.1,
 top: hovering ? idx * -50 : 0,
 zIndex: -idx,
 opacity: idx < 3 ? 1 - idx * 0.1 : 0
 }}
 animate={{
 y: isActive(tab) ? [0, 40, 0] : 0
 }}
 className={`plasmo-w-full plasmo-h-full plasmo-absolute plasmo-top-0 plasmo-left-0 plasmo-overflow-y-auto plasmo-no-visible-scrollbar ${className || ""}`}>
 {tab.content}
 </motion.div>
 ))}
 </div>
 )
}
