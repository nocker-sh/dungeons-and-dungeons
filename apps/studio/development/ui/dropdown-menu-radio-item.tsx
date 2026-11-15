import { omitProps } from "@/client/utils/omit-props"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"

type Props = MenuPrimitive.RadioItem.Props & {
  inset?: boolean
}

export function DropdownMenuRadioItem(props: Props) {
  const restProps = omitProps(props, ["className", "children", "inset"])

  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={props.inset}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        props.className
      )}
      {...restProps}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {props.children}
    </MenuPrimitive.RadioItem>
  )
}
