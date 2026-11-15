"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function SheetHeader(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", props.className)}
      {...restProps}
    />
  )
}
