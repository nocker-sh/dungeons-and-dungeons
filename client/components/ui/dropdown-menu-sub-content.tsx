import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { DropdownMenuContent } from "@/client/components/ui/dropdown-menu-content"

type Props = React.ComponentProps<typeof DropdownMenuContent>

export function DropdownMenuSubContent(props: Props) {
  const align = props.align === undefined ? "start" : props.align
  const alignOffset = props.alignOffset === undefined ? -3 : props.alignOffset
  const side = props.side === undefined ? "right" : props.side
  const sideOffset = props.sideOffset === undefined ? 0 : props.sideOffset
  const restProps = omitProps(props, [
    "align",
    "alignOffset",
    "side",
    "sideOffset",
    "className",
  ])

  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "w-auto min-w-[96px] rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        props.className
      )}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...restProps}
    />
  )
}
