"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { toggleVariants } from "@/client/components/ui/toggle-variants"

export type Props = TogglePrimitive.Props & VariantProps<typeof toggleVariants>

export function Toggle(props: Props) {
  const variant = props.variant === undefined ? "default" : props.variant
  const size = props.size === undefined ? "default" : props.size
  const restProps = omitProps(props, ["className", "variant", "size"])

  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(
        toggleVariants({ variant, size, className: props.className })
      )}
      {...restProps}
    />
  )
}
