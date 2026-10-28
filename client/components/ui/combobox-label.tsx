"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"

type Props = ComboboxPrimitive.GroupLabel.Props

export function ComboboxLabel(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn(
        "px-2 py-1.5 text-xs text-muted-foreground",
        props.className
      )}
      {...restProps}
    />
  )
}
