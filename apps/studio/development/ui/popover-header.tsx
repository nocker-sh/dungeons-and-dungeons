"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function PopoverHeader(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-0.5 text-sm", props.className)}
      {...restProps}
    />
  )
}
