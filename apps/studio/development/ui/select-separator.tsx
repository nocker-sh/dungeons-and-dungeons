"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "cn"

type Props = SelectPrimitive.Separator.Props

export function SelectSeparator(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn(
        "pointer-events-none -mx-1 my-1 h-px bg-border",
        props.className
      )}
      {...restProps}
    />
  )
}
