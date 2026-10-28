import * as React from "react"
import { omitProps } from "@/client/utils/omit-props"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { itemMediaVariants } from "@/client/components/ui/item-media-variants"

export type Props = React.ComponentProps<"div"> &
  VariantProps<typeof itemMediaVariants>

export function ItemMedia(props: Props) {
  const variant = props.variant === undefined ? "default" : props.variant
  const restProps = omitProps(props, ["className", "variant"])

  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(itemMediaVariants({ variant, className: props.className }))}
      {...restProps}
    />
  )
}
