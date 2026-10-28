import { omitProps } from "@/client/utils/omit-props"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cn } from "cn"

type Props = MenuPrimitive.Separator.Props

export function DropdownMenuSeparator(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", props.className)}
      {...restProps}
    />
  )
}
