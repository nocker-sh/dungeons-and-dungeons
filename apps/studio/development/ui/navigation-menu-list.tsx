import { omitProps } from "@/client/utils/omit-props"
import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu"
import { cn } from "cn"

type Props = React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.List>

export function NavigationMenuList(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn(
        "group flex flex-1 list-none items-center justify-center gap-0",
        props.className
      )}
      {...restProps}
    />
  )
}
