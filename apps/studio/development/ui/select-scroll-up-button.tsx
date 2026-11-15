"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "cn"
import { ChevronUpIcon } from "lucide-react"

type Props = React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>

export function SelectScrollUpButton(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        props.className
      )}
      {...restProps}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpArrow>
  )
}
