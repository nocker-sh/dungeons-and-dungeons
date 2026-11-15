"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"td">

export function TableCell(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        props.className
      )}
      {...restProps}
    />
  )
}
