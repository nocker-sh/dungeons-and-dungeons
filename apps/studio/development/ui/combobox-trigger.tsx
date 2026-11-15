"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"
import { ChevronDownIcon } from "lucide-react"

type Props = ComboboxPrimitive.Trigger.Props

export function ComboboxTrigger(props: Props) {
  const restProps = omitProps(props, ["className", "children"])

  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn("[&_svg:not([class*='size-'])]:size-4", props.className)}
      {...restProps}
    >
      {props.children}
      <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
    </ComboboxPrimitive.Trigger>
  )
}
