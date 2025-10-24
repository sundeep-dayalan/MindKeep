"use client"

import { motion } from "motion/react"
import React, { useEffect, useState } from "react"

import { cn } from "../../lib/utils"

type Direction = "TOP" | "LEFT" | "BOTTOM" | "RIGHT"

export function HoverBorderGradient({
 children,
 containerClassName,
 className,
 as: Tag = "button",
 duration = 1,
 clockwise = true,
 ...props
}: React.PropsWithChildren<
 {
 as?: React.ElementType
 containerClassName?: string
 className?: string
 duration?: number
 clockwise?: boolean
 } & React.HTMLAttributes<HTMLElement>
>) {
 const [hovered, setHovered] = useState<boolean>(false)
 const [direction, setDirection] = useState<Direction>("TOP")

 const rotateDirection = (currentDirection: Direction): Direction => {
 const directions: Direction[] = ["TOP", "LEFT", "BOTTOM", "RIGHT"]
 const currentIndex = directions.indexOf(currentDirection)
 const nextIndex = clockwise
 ? (currentIndex - 1 + directions.length) % directions.length
 : (currentIndex + 1) % directions.length
 return directions[nextIndex]
 }

 const movingMap: Record<Direction, string> = {
 TOP: "radial-gradient(20.7% 50% at 50% 0%, hsla(0, 90%, 43%, 1.00) 0%, rgba(100, 194, 244, 0) 100%)",
 LEFT: "radial-gradient(16.6% 43.1% at 0% 50%, hsla(246, 67%, 69%, 1.00) 0%, rgba(75, 151, 227, 0) 100%)",
 BOTTOM:
 "radial-gradient(20.7% 50% at 50% 100%, hsla(76, 100%, 55%, 1.00) 0%, rgba(103, 153, 232, 0) 100%)",
 RIGHT:
 "radial-gradient(16.2% 41.199999999999996% at 100% 50%, hsla(239, 69%, 75%, 1.00) 0%, rgba(255, 255, 255, 0) 100%)"
 }

 const highlight =
 "radial-gradient(75% 181.15942028985506% at 50% 50%, #3275F8 0%, rgba(255, 255, 255, 0) 100%)"

 useEffect(() => {
 if (!hovered) {
 const interval = setInterval(() => {
 setDirection((prevState) => rotateDirection(prevState))
 }, duration * 1000)
 return () => clearInterval(interval)
 }
 }, [hovered])
 return (
 <Tag
 onMouseEnter={(event: React.MouseEvent<HTMLDivElement>) => {
 setHovered(true)
 }}
 onMouseLeave={() => setHovered(false)}
 className={cn(
 "plasmo-relative plasmo-flex plasmo-rounded-full plasmo-border plasmo-content-center plasmo-bg-yellow/20 hover:plasmo-bg-yellow/10 plasmo-transition plasmo-duration-500 dark:plasmo-bg-white/20 plasmo-items-center plasmo-flex-col plasmo-flex-nowrap plasmo-gap-10 plasmo-h-min plasmo-justify-center plasmo-overflow-visible plasmo-p-px plasmo-decoration-clone plasmo-w-fit",
 containerClassName
 )}
 {...props}>
 <div
 className={cn(
 "plasmo-w-auto plasmo-text-white plasmo-z-10 plasmo-bg-yellow plasmo-px-4 plasmo-py-2 plasmo-rounded-[inherit]",
 className
 )}>
 {children}
 </div>
 <motion.div
 className={cn(
 "plasmo-flex-none plasmo-inset-0 plasmo-overflow-hidden plasmo-absolute plasmo-z-0 plasmo-rounded-[inherit]"
 )}
 style={{
 filter: "blur(2px)",
 position: "absolute",
 width: "100%",
 height: "100%"
 }}
 initial={{ background: movingMap[direction] }}
 animate={{
 background: hovered
 ? [movingMap[direction], highlight]
 : movingMap[direction]
 }}
 transition={{ ease: "linear", duration: duration ?? 1 }}
 />
 <div className="plasmo-bg-yellow plasmo-absolute plasmo-z-1 plasmo-flex-none plasmo-inset-[2px] plasmo-rounded-[100px]" />
 </Tag>
 )
}
