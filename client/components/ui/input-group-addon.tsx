import * as React from "react"
import { omitProps } from "@/client/utils/omit-props"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { inputGroupAddonVariants } from "@/client/components/ui/input-group-addon-variants"

export type Props = React.ComponentProps<"div"> &
  VariantProps<typeof inputGroupAddonVariants>

export function InputGroupAddon(props: Props) {
  const align = props.align === undefined ? "inline-start" : props.align
  const restProps = omitProps(props, ["className", "align"])

  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), props.className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...restProps}
    />
  )
}
