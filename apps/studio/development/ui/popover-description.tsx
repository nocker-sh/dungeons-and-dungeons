"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "cn"

type Props = PopoverPrimitive.Description.Props

export function PopoverDescription(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-muted-foreground", props.className)}
      {...restProps}
    />
  )
}
