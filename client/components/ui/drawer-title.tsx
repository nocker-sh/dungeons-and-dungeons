import { omitProps } from "@/client/utils/omit-props"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"
import { cn } from "cn"

type Props = DrawerPrimitive.Title.Props

export function DrawerTitle(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        props.className
      )}
      {...restProps}
    />
  )
}
