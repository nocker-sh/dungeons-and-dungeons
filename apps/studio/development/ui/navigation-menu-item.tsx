import { omitProps } from "@/client/utils/omit-props"
import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu"
import { cn } from "cn"

type Props = React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.Item>

export function NavigationMenuItem(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <NavigationMenuPrimitive.Item
      data-slot="navigation-menu-item"
      className={cn("relative", props.className)}
      {...restProps}
    />
  )
}
