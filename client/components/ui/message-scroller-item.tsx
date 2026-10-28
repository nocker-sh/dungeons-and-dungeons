"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { MessageScroller as MessageScrollerPrimitive } from "@shadcn/react/message-scroller"
import { cn } from "cn"

type Props = React.ComponentProps<typeof MessageScrollerPrimitive.Item>

export function MessageScrollerItem(props: Props) {
  const scrollAnchor =
    props.scrollAnchor === undefined ? false : props.scrollAnchor
  const restProps = omitProps(props, ["className", "scrollAnchor"])

  return (
    <MessageScrollerPrimitive.Item
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      className={cn(
        "min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]",
        props.className
      )}
      {...restProps}
    />
  )
}
