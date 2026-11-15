"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "cn"

type Props = SelectPrimitive.GroupLabel.Props

export function SelectLabel(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(
        "px-1.5 py-1 text-xs text-muted-foreground",
        props.className
      )}
      {...restProps}
    />
  )
}
