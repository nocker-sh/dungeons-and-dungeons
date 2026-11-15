"use client"

import * as React from "react"
import { MessageScroller as MessageScrollerPrimitive } from "@shadcn/react/message-scroller"

type Props = React.ComponentProps<typeof MessageScrollerPrimitive.Provider>

export function MessageScrollerProvider(props: Props) {
  return <MessageScrollerPrimitive.Provider {...props} />
}
