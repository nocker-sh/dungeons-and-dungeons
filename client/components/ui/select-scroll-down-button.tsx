"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "cn"
import { ChevronDownIcon } from "lucide-react"

type Props = React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>

export function SelectScrollDownButton(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        props.className
      )}
      {...restProps}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownArrow>
  )
}
