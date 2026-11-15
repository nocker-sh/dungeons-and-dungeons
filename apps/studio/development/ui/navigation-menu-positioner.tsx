import { omitProps } from "@/client/utils/omit-props"
import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu"
import { cn } from "cn"

type Props = NavigationMenuPrimitive.Positioner.Props

export function NavigationMenuPositioner(props: Props) {
  const side = props.side === undefined ? "bottom" : props.side
  const sideOffset = props.sideOffset === undefined ? 8 : props.sideOffset
  const align = props.align === undefined ? "start" : props.align
  const alignOffset = props.alignOffset === undefined ? 0 : props.alignOffset
  const restProps = omitProps(props, [
    "className",
    "side",
    "sideOffset",
    "align",
    "alignOffset",
  ])

  return (
    <NavigationMenuPrimitive.Portal>
      <NavigationMenuPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className={cn(
          "isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none data-[side=bottom]:before:top-[-10px] data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0",
          props.className
        )}
        {...restProps}
      >
        <NavigationMenuPrimitive.Popup className="data-[ending-style]:easing-[ease] xs:w-(--popup-width) relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) rounded-lg bg-popover text-popover-foreground shadow ring-1 ring-foreground/10 transition-[opacity,transform,width,height,scale,translate] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] outline-none data-ending-style:scale-90 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-90 data-starting-style:opacity-0">
          <NavigationMenuPrimitive.Viewport className="relative size-full overflow-hidden" />
        </NavigationMenuPrimitive.Popup>
      </NavigationMenuPrimitive.Positioner>
    </NavigationMenuPrimitive.Portal>
  )
}
