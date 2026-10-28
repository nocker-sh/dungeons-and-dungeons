"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { Separator } from "@/client/components/ui/separator"

type Props = React.ComponentProps<typeof Separator>

export function SidebarSeparator(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn(
        "mx-2 bg-sidebar-border data-horizontal:w-auto",
        props.className
      )}
      {...restProps}
    />
  )
}
