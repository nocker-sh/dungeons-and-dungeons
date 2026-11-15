"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function SidebarGroupContent(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("w-full text-sm", props.className)}
      {...restProps}
    />
  )
}
