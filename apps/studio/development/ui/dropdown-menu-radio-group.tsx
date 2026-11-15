import { omitProps } from "@/client/utils/omit-props"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

type Props = MenuPrimitive.RadioGroup.Props

export function DropdownMenuRadioGroup(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <MenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...restProps}
    />
  )
}
