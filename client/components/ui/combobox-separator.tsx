"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"

type Props = ComboboxPrimitive.Separator.Props

export function ComboboxSeparator(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={cn("-mx-1 my-1 h-px bg-border", props.className)}
      {...restProps}
    />
  )
}
