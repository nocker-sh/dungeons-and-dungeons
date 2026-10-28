import { omitProps } from "@/client/utils/omit-props"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"
import { cn } from "cn"

type Props = DrawerPrimitive.Description.Props

export function DrawerDescription(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn(
        "text-sm text-balance text-muted-foreground",
        props.className
      )}
      {...restProps}
    />
  )
}
