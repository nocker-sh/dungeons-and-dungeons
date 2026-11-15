"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function DialogHeader(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", props.className)}
      {...restProps}
    />
  )
}
