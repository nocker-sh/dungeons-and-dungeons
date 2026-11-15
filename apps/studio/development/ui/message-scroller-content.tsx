"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { MessageScroller as MessageScrollerPrimitive } from "@shadcn/react/message-scroller"
import { cn } from "cn"

type Props = React.ComponentProps<typeof MessageScrollerPrimitive.Content>

export function MessageScrollerContent(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <MessageScrollerPrimitive.Content
      data-slot="message-scroller-content"
      className={cn("flex h-max min-h-full flex-col gap-6", props.className)}
      {...restProps}
    />
  )
}
