"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { Skeleton } from "@/client/components/ui/skeleton"

type Props = React.ComponentProps<"div"> & {
  showIcon?: boolean
}

export function SidebarMenuSkeleton(props: Props) {
  const showIcon = props.showIcon === undefined ? false : props.showIcon
  const restProps = omitProps(props, ["className", "showIcon"])

  // Random width between 50 to 90%.
  const [width] = React.useState(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  })

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn(
        "flex h-8 items-center gap-2 rounded-md px-2",
        props.className
      )}
      {...restProps}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  )
}
