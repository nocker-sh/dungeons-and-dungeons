"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"

type Props = ComboboxPrimitive.Input.Props

export function ComboboxChipsInput(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      className={cn("min-w-16 flex-1 outline-none", props.className)}
      {...restProps}
    />
  )
}
