import { omitProps } from "@/client/utils/omit-props"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

type Props = DrawerPrimitive.Portal.Props

export function DrawerPortal(props: Props) {
  const restProps = omitProps(props, [])

  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...restProps} />
}
