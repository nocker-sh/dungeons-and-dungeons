import { omitProps } from "@/client/utils/omit-props"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cn } from "cn"

type Props = MenuPrimitive.GroupLabel.Props & {
  inset?: boolean
}

export function DropdownMenuLabel(props: Props) {
  const restProps = omitProps(props, ["className", "inset"])

  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={props.inset}
      className={cn(
        "px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7",
        props.className
      )}
      {...restProps}
    />
  )
}
