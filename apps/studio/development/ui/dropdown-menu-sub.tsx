import { omitProps } from "@/client/utils/omit-props"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

type Props = MenuPrimitive.SubmenuRoot.Props

export function DropdownMenuSub(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...restProps} />
  )
}
