import { omitProps } from "@/client/utils/omit-props"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

type Props = MenuPrimitive.Portal.Props

export function DropdownMenuPortal(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...restProps} />
  )
}
