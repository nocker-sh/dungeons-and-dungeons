"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"table">

export function Table(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", props.className)}
        {...restProps}
      />
    </div>
  )
}
