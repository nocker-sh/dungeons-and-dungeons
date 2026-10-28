"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"

type Props = ComboboxPrimitive.Group.Props

export function ComboboxGroup(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ComboboxPrimitive.Group
      data-slot="combobox-group"
      className={cn(props.className)}
      {...restProps}
    />
  )
}
