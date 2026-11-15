"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"

type Props = ComboboxPrimitive.Empty.Props

export function ComboboxEmpty(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        "hidden w-full justify-center py-2 text-center text-sm text-muted-foreground group-data-empty/combobox-content:flex",
        props.className
      )}
      {...restProps}
    />
  )
}
