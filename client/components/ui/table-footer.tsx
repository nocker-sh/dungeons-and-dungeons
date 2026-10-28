"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"tfoot">

export function TableFooter(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        props.className
      )}
      {...restProps}
    />
  )
}
