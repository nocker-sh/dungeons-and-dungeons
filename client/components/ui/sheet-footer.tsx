"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function SheetFooter(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", props.className)}
      {...restProps}
    />
  )
}
