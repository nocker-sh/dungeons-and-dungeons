"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { toggleVariants } from "@/client/components/ui/toggle-variants"
import { ToggleGroupContext } from "@/client/components/ui/toggle-group-shared"

type Props = ToggleGroupPrimitive.Props &
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: "horizontal" | "vertical"
  }

export function ToggleGroup(props: Props) {
  const spacing = props.spacing === undefined ? 2 : props.spacing
  const orientation =
    props.orientation === undefined ? "horizontal" : props.orientation
  const restProps = omitProps(props, [
    "className",
    "variant",
    "size",
    "spacing",
    "orientation",
    "children",
  ])

  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={props.variant}
      data-size={props.size}
      data-spacing={spacing}
      data-orientation={orientation}
      style={{ "--gap": spacing } as React.CSSProperties}
      className={cn(
        "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-lg data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-vertical:flex-col data-vertical:items-stretch",
        props.className
      )}
      {...restProps}
    >
      <ToggleGroupContext.Provider
        value={{
          variant: props.variant,
          size: props.size,
          spacing,
          orientation,
        }}
      >
        {props.children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}
