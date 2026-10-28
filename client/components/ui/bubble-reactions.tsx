import * as React from "react"
import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"
import { bubbleReactionsVariants } from "@/client/components/ui/bubble-reactions-variants"

export type Props = React.ComponentProps<"div"> & {
  align?: "start" | "end"
  side?: "top" | "bottom"
}

export function BubbleReactions(props: Props) {
  const side = props.side === undefined ? "bottom" : props.side
  const align = props.align === undefined ? "end" : props.align
  const restProps = omitProps(props, ["side", "align", "className"])

  return (
    <div
      data-slot="bubble-reactions"
      data-align={align}
      data-side={side}
      className={cn(bubbleReactionsVariants({ side, align }), props.className)}
      {...restProps}
    />
  )
}
