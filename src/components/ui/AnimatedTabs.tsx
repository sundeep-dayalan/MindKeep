"use client"

import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"

import { cn } from "../../lib/utils"

type Tab = {
 title: string
 value: string
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

 // Update tabs and active state when propTabs changes
 useEffect(() => {
 setTabs(propTabs)
 setActive(propTabs[0])
 }, [propTabs])

 const moveSelectedTabToTop = (idx: number) => {
 const newTabs = [...propTabs]
 const selectedTab = newTabs.splice(idx, 1)
 newTabs.unshift(selectedTab[0])
 setTabs(newTabs)
 setActive(newTabs[0])

 // Notify parent of tab change
 if (onTabChange && selectedTab[0]) {
 onTabChange(selectedTab[0].value)
 }
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
 className={cn(
 "flex flex-row items-center justify-start [perspective:1000px] relative overflow-x-auto overflow-y-hidden no-visible-scrollbar max-w-full w-full gap-1 p-1 bg-slate-100/80 rounded-full backdrop-blur-sm",
 containerClassName
 )}>
 {propTabs.map((tab, idx) => (
 <button
 key={tab.title}
 onClick={() => {
 moveSelectedTabToTop(idx)
 }}
 onMouseEnter={() => setHovering(true)}
 onMouseLeave={() => setHovering(false)}
 className={cn(
 "relative px-4 py-2.5 rounded-full transition-all duration-200 flex-shrink-0",
 tabClassName
 )}
 style={{
 transformStyle: "preserve-3d"
 }}>
 {active.value === tab.value && (
 <motion.div
 layoutId="clickedbutton"
 transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
 className={cn(
 "absolute inset-0 bg-slate-800 rounded-full shadow-lg",
 activeTabClassName
 )}
 />
 )}

 <span
 className={cn(
 "relative block text-sm font-semibold capitalize transition-colors duration-200 whitespace-nowrap",
 active.value === tab.value
 ? "text-white"
 : "text-slate-600 hover:text-slate-800"
 )}>
 {tab.title}
 </span>
 </button>
 ))}
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
 <div className="relative w-full h-full">
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
 className={cn("w-full h-full absolute top-0 left-0", className)}>
 {tab.content}
 </motion.div>
 ))}
 </div>
 )
}
