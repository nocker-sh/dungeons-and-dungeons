"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function SidebarGroup(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn(
        "relative flex w-full min-w-0 flex-col p-2",
        props.className
      )}
      {...restProps}
    />
  )
}
