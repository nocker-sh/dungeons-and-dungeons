import { omitProps } from "@/client/utils/omit-props"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

type Props = DrawerPrimitive.Trigger.Props

export function DrawerTrigger(props: Props) {
  const restProps = omitProps(props, [])

  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...restProps} />
}
