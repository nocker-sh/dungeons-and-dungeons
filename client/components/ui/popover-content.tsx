"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "cn"

type Props = PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >

export function PopoverContent(props: Props) {
  const align = props.align === undefined ? "center" : props.align
  const alignOffset = props.alignOffset === undefined ? 0 : props.alignOffset
  const side = props.side === undefined ? "bottom" : props.side
  const sideOffset = props.sideOffset === undefined ? 4 : props.sideOffset
  const restProps = omitProps(props, [
    "className",
    "align",
    "alignOffset",
    "side",
    "sideOffset",
  ])

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 flex w-72 origin-(--transform-origin) flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            props.className
          )}
          {...restProps}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}
