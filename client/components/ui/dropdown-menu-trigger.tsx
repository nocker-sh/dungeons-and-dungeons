import { omitProps } from "@/client/utils/omit-props"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

type Props = MenuPrimitive.Trigger.Props

export function DropdownMenuTrigger(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...restProps} />
  )
}
