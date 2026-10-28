import { omitProps } from "@/client/utils/omit-props"
import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu"
import { cn } from "cn"
import { NavigationMenuPositioner } from "@/client/components/ui/navigation-menu-positioner"

type Props = NavigationMenuPrimitive.Root.Props &
  Pick<NavigationMenuPrimitive.Positioner.Props, "align">

export function NavigationMenu(props: Props) {
  const align = props.align === undefined ? "start" : props.align
  const restProps = omitProps(props, ["align", "className", "children"])

  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      className={cn(
        "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
        props.className
      )}
      {...restProps}
    >
      {props.children}
      <NavigationMenuPositioner align={align} />
    </NavigationMenuPrimitive.Root>
  )
}
