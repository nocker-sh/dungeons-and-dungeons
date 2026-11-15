"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"li">

export function SidebarMenuSubItem(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("group/menu-sub-item relative", props.className)}
      {...restProps}
    />
  )
}
