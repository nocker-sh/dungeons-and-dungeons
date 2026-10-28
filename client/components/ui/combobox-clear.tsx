"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"
import { InputGroupButton } from "@/client/components/ui/input-group-button"
import { XIcon } from "lucide-react"

type Props = ComboboxPrimitive.Clear.Props

export function ComboboxClear(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      render={<InputGroupButton variant="ghost" size="icon-xs" />}
      className={cn(props.className)}
      {...restProps}
    >
      <XIcon className="pointer-events-none" />
    </ComboboxPrimitive.Clear>
  )
}
