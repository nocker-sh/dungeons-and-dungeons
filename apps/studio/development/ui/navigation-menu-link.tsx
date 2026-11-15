import { omitProps } from "@/client/utils/omit-props"
import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu"
import { cn } from "cn"

type Props = NavigationMenuPrimitive.Link.Props

export function NavigationMenuLink(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      className={cn(
        "flex items-center gap-2 rounded-lg p-2 text-sm transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 in-data-[slot=navigation-menu-content]:rounded-md data-active:bg-muted/50 data-active:hover:bg-muted data-active:focus:bg-muted [&_svg:not([class*='size-'])]:size-4",
        props.className
      )}
      {...restProps}
    />
  )
}
