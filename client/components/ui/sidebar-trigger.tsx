"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { Button } from "@/client/components/ui/button"
import { PanelLeftIcon } from "lucide-react"
import { useSidebar } from "@/client/components/ui/sidebar-shared"

type Props = React.ComponentProps<typeof Button>

export function SidebarTrigger(props: Props) {
  const restProps = omitProps(props, ["className", "onClick"])

  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      className={cn(props.className)}
      onClick={(event) => {
        props.onClick?.(event)
        toggleSidebar()
      }}
      {...restProps}
    >
      <PanelLeftIcon />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}
