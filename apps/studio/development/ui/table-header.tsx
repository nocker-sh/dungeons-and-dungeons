"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"thead">

export function TableHeader(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", props.className)}
      {...restProps}
    />
  )
}
