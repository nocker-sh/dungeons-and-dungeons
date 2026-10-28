import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { DropdownMenuContent } from "@/client/components/ui/dropdown-menu-content"

type Props = React.ComponentProps<typeof DropdownMenuContent>

export function MenubarContent(props: Props) {
  const align = props.align === undefined ? "start" : props.align
  const alignOffset = props.alignOffset === undefined ? -4 : props.alignOffset
  const sideOffset = props.sideOffset === undefined ? 8 : props.sideOffset
  const restProps = omitProps(props, [
    "className",
    "align",
    "alignOffset",
    "sideOffset",
  ])

  return (
    <DropdownMenuContent
      data-slot="menubar-content"
      align={align}
      alignOffset={alignOffset}
      sideOffset={sideOffset}
      className={cn(
        "min-w-36 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
        props.className
      )}
      {...restProps}
    />
  )
}
