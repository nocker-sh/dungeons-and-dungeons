import { omitProps } from "@/client/utils/omit-props"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

type Props = MenuPrimitive.Group.Props

export function DropdownMenuGroup(props: Props) {
  const restProps = omitProps(props, [])

  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...restProps} />
}
