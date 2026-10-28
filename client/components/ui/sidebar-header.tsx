"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function SidebarHeader(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", props.className)}
      {...restProps}
    />
  )
}
