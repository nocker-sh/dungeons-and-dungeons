"use client"

import * as React from "react"
import { omitProps } from "@/client/utils/omit-props"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Tooltip } from "@/client/components/ui/tooltip"
import { TooltipContent } from "@/client/components/ui/tooltip-content"
import { TooltipTrigger } from "@/client/components/ui/tooltip-trigger"
import { useSidebar } from "@/client/components/ui/sidebar-shared"
import { sidebarMenuButtonVariants } from "@/client/components/ui/sidebar-menu-button-variants"

export type Props = useRender.ComponentProps<"button"> &
  React.ComponentProps<"button"> & {
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof TooltipContent>
  } & VariantProps<typeof sidebarMenuButtonVariants>

export function SidebarMenuButton(props: Props) {
  const isActive = props.isActive === undefined ? false : props.isActive
  const variant = props.variant === undefined ? "default" : props.variant
  const size = props.size === undefined ? "default" : props.size
  const restProps = omitProps(props, [
    "render",
    "isActive",
    "variant",
    "size",
    "tooltip",
    "className",
  ])

  const { isMobile, state } = useSidebar()
  const comp = useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          sidebarMenuButtonVariants({ variant, size }),
          props.className
        ),
      },
      restProps
    ),
    render: !props.tooltip ? (
      props.render
    ) : (
      <TooltipTrigger render={props.render} />
    ),
    state: {
      slot: "sidebar-menu-button",
      sidebar: "menu-button",
      size,
      active: isActive,
    },
  })

  if (!props.tooltip) {
    return comp
  }

  if (typeof props.tooltip === "string") {
    props.tooltip = {
      children: props.tooltip,
    }
  }

  return (
    <Tooltip>
      {comp}
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...props.tooltip}
      />
    </Tooltip>
  )
}
