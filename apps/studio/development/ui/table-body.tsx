"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"tbody">

export function TableBody(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", props.className)}
      {...restProps}
    />
  )
}
