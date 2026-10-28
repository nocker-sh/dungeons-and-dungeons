"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { Input } from "@/client/components/ui/input"

type Props = React.ComponentProps<typeof Input>

export function SidebarInput(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn("h-8 w-full bg-background shadow-none", props.className)}
      {...restProps}
    />
  )
}
