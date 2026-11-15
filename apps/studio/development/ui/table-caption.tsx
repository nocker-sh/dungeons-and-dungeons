"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"caption">

export function TableCaption(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", props.className)}
      {...restProps}
    />
  )
}
