import * as React from "react"
import { omitProps } from "@/client/utils/omit-props"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { bubbleVariants } from "@/client/components/ui/bubble-variants"

export type Props = React.ComponentProps<"div"> &
  VariantProps<typeof bubbleVariants> & {
    align?: "start" | "end"
  }

export function Bubble(props: Props) {
  const variant = props.variant === undefined ? "default" : props.variant
  const align = props.align === undefined ? "start" : props.align
  const restProps = omitProps(props, ["variant", "align", "className"])

  return (
    <div
      data-slot="bubble"
      data-variant={variant}
      data-align={align}
      className={cn(bubbleVariants({ variant }), props.className)}
      {...restProps}
    />
  )
}
