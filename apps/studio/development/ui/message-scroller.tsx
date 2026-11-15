"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { MessageScroller as MessageScrollerPrimitive } from "@shadcn/react/message-scroller"
import { cn } from "cn"

type Props = React.ComponentProps<typeof MessageScrollerPrimitive.Root>

export function MessageScroller(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      className={cn(
        "group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden",
        props.className
      )}
      {...restProps}
    />
  )
}
