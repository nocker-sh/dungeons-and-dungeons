"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"ul">

export function SidebarMenu(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-0", props.className)}
      {...restProps}
    />
  )
}
