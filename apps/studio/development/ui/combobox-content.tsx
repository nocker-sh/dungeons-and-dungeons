"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"

type Props = ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
  >

export function ComboboxContent(props: Props) {
  const side = props.side === undefined ? "bottom" : props.side
  const sideOffset = props.sideOffset === undefined ? 6 : props.sideOffset
  const align = props.align === undefined ? "start" : props.align
  const alignOffset = props.alignOffset === undefined ? 0 : props.alignOffset
  const restProps = omitProps(props, [
    "className",
    "side",
    "sideOffset",
    "align",
    "alignOffset",
    "anchor",
  ])

  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={props.anchor}
        className="isolate z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-chips={!!props.anchor}
          className={cn(
            "group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[chips=true]:min-w-(--anchor-width) data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            props.className
          )}
          {...restProps}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}
