"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "cn"

type Props = SelectPrimitive.Value.Props

export function SelectValue(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", props.className)}
      {...restProps}
    />
  )
}
