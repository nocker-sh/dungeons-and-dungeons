import { omitProps } from "@/client/utils/omit-props"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { cn } from "cn"

type Props = ContextMenuPrimitive.Popup.Props &
  Pick<
    ContextMenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >

export function ContextMenuContent(props: Props) {
  const align = props.align === undefined ? "start" : props.align
  const alignOffset = props.alignOffset === undefined ? 4 : props.alignOffset
  const side = props.side === undefined ? "right" : props.side
  const sideOffset = props.sideOffset === undefined ? 0 : props.sideOffset
  const restProps = omitProps(props, [
    "className",
    "align",
    "alignOffset",
    "side",
    "sideOffset",
  ])

  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(
            "z-50 max-h-(--available-height) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            props.className
          )}
          {...restProps}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}
