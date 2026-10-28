"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function SidebarContent(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "no-scrollbar flex min-h-0 flex-1 flex-col gap-0 overflow-x-hidden overflow-y-auto group-data-[collapsible=icon]:overflow-hidden",
        props.className
      )}
      {...restProps}
    />
  )
}
