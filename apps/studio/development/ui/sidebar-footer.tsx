"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function SidebarFooter(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", props.className)}
      {...restProps}
    />
  )
}
