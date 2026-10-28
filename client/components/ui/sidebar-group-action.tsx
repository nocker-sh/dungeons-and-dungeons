"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cn } from "cn"

type Props = useRender.ComponentProps<"button"> & React.ComponentProps<"button">

export function SidebarGroupAction(props: Props) {
  const restProps = omitProps(props, ["className", "render"])

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          "absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
          props.className
        ),
      },
      restProps
    ),
    render: props.render,
    state: {
      slot: "sidebar-group-action",
      sidebar: "group-action",
    },
  })
}
