import { omitProps } from "@/client/utils/omit-props"
import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu"
import { cn } from "cn"
import { ChevronDownIcon } from "lucide-react"
import { navigationMenuTriggerStyle } from "@/client/components/ui/navigation-menu-trigger-style"

export type Props = NavigationMenuPrimitive.Trigger.Props

export function NavigationMenuTrigger(props: Props) {
  const restProps = omitProps(props, ["className", "children"])

  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      className={cn(navigationMenuTriggerStyle(), "group", props.className)}
      {...restProps}
    >
      {props.children}{" "}
      <ChevronDownIcon
        className="relative top-px ml-1 size-3 transition duration-300 group-data-popup-open/navigation-menu-trigger:rotate-180 group-data-open/navigation-menu-trigger:rotate-180"
        aria-hidden="true"
      />
    </NavigationMenuPrimitive.Trigger>
  )
}
