"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"
import { Button } from "@/client/components/ui/button"
import { XIcon } from "lucide-react"

type Props = ComboboxPrimitive.Chip.Props & {
  showRemove?: boolean
}

export function ComboboxChip(props: Props) {
  const showRemove = props.showRemove === undefined ? true : props.showRemove
  const restProps = omitProps(props, ["className", "children", "showRemove"])

  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn(
        "flex h-[calc(--spacing(5.25))] w-fit items-center justify-center gap-1 rounded-sm bg-muted px-1.5 text-xs font-medium whitespace-nowrap text-foreground has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=combobox-chip-remove]:pr-0",
        props.className
      )}
      {...restProps}
    >
      {props.children}
      {showRemove && (
        <ComboboxPrimitive.ChipRemove
          render={<Button variant="ghost" size="icon-xs" />}
          className="-ml-1 opacity-50 hover:opacity-100"
          data-slot="combobox-chip-remove"
        >
          <XIcon className="pointer-events-none" />
        </ComboboxPrimitive.ChipRemove>
      )}
    </ComboboxPrimitive.Chip>
  )
}
