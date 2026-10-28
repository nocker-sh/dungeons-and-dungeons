"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { toggleVariants } from "@/client/components/ui/toggle-variants"
import { ToggleGroupContext } from "@/client/components/ui/toggle-group-shared"

type Props = TogglePrimitive.Props & VariantProps<typeof toggleVariants>

export function ToggleGroupItem(props: Props) {
  const variant = props.variant === undefined ? "default" : props.variant
  const size = props.size === undefined ? "default" : props.size
  const restProps = omitProps(props, [
    "className",
    "children",
    "variant",
    "size",
  ])

  const context = React.useContext(ToggleGroupContext)

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        "shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-1.5 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-lg group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-lg group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-lg group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-lg group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        props.className
      )}
      {...restProps}
    >
      {props.children}
    </TogglePrimitive>
  )
}
