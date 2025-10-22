import React from "react"

import { cn } from "~lib/utils"

export const BentoGrid = ({
  className,
  children
}: {
  className?: string
  children?: React.ReactNode
}) => {
  const finalClassName = cn(
    "plasmo-grid plasmo-gap-2 plasmo-w-full",
    // Responsive columns: 2 cols (default) -> 3 cols (wide)
    "plasmo-grid-cols-2 lg:plasmo-grid-cols-3",
    className
  )

  return <div className={finalClassName}>{children}</div>
}

export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  icon,
  onClick
}: {
  className?: string
  title?: string | React.ReactNode
  description?: string | React.ReactNode
  header?: React.ReactNode
  icon?: React.ReactNode
  onClick?: () => void
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "plasmo-rounded-lg plasmo-group/bento plasmo-transition-all plasmo-duration-200 plasmo-p-2.5 plasmo-bg-white plasmo-border plasmo-border-slate-200 plasmo-flex plasmo-flex-col plasmo-gap-2 plasmo-cursor-pointer hover:plasmo-border-blue-300 hover:plasmo-shadow-md plasmo-h-[160px]",
        className
      )}>
      {header}
      <div className="plasmo-group-hover/bento:plasmo-translate-x-0.5 plasmo-transition plasmo-duration-200 plasmo-flex plasmo-flex-col plasmo-gap-1 plasmo-overflow-hidden">
        {icon}
        <div className="plasmo-font-sans plasmo-font-semibold plasmo-text-slate-900 plasmo-text-sm plasmo-line-clamp-1">
          {title}
        </div>
        <div className="plasmo-font-sans plasmo-font-normal plasmo-text-slate-600 plasmo-text-xs plasmo-line-clamp-2">
          {description}
        </div>
      </div>
    </div>
  )
}
