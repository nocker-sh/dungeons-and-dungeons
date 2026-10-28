import { omitProps } from "@/client/utils/omit-props"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

type Props = MenuPrimitive.Root.Props

export function DropdownMenu(props: Props) {
  const restProps = omitProps(props, [])

  return <MenuPrimitive.Root data-slot="dropdown-menu" {...restProps} />
}
