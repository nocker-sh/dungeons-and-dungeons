"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "cn"

type Props = PopoverPrimitive.Title.Props

export function PopoverTitle(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("font-medium", props.className)}
      {...restProps}
    />
  )
}
