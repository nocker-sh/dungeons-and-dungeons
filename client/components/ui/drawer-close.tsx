import { omitProps } from "@/client/utils/omit-props"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

type Props = DrawerPrimitive.Close.Props

export function DrawerClose(props: Props) {
  const restProps = omitProps(props, [])

  return <DrawerPrimitive.Close data-slot="drawer-close" {...restProps} />
}
