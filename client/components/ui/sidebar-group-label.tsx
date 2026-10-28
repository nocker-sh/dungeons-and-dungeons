"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cn } from "cn"

type Props = useRender.ComponentProps<"div"> & React.ComponentProps<"div">

export function SidebarGroupLabel(props: Props) {
  const restProps = omitProps(props, ["className", "render"])

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
          props.className
        ),
      },
      restProps
    ),
    render: props.render,
    state: {
      slot: "sidebar-group-label",
      sidebar: "group-label",
    },
  })
}
