"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { MessageScroller as MessageScrollerPrimitive } from "@shadcn/react/message-scroller"
import { cn } from "cn"

type Props = React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>

export function MessageScrollerViewport(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <MessageScrollerPrimitive.Viewport
      data-slot="message-scroller-viewport"
      className={cn(
        "size-full min-h-0 min-w-0 scroll-fade-b scrollbar-thin scrollbar-gutter-stable overflow-y-auto overscroll-contain contain-content data-autoscrolling:scrollbar-thumb-transparent data-autoscrolling:scrollbar-track-transparent data-pending-scroll:invisible",
        props.className
      )}
      {...restProps}
    />
  )
}
