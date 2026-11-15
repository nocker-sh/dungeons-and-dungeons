"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"

type Props = React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> &
  ComboboxPrimitive.Chips.Props

export function ComboboxChips(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      className={cn(
        "flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent bg-clip-padding px-2.5 py-1 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 has-data-[slot=combobox-chip]:px-1 dark:bg-input/30 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40",
        props.className
      )}
      {...restProps}
    />
  )
}
