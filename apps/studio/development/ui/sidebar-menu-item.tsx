"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"li">

export function SidebarMenuItem(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", props.className)}
      {...restProps}
    />
  )
}
