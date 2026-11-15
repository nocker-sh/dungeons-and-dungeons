import { omitProps } from "@/client/utils/omit-props"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"

type Props = ContextMenuPrimitive.CheckboxItem.Props & {
  inset?: boolean
}

export function ContextMenuCheckboxItem(props: Props) {
  const restProps = omitProps(props, [
    "className",
    "children",
    "checked",
    "inset",
  ])

  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      data-inset={props.inset}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        props.className
      )}
      checked={props.checked}
      {...restProps}
    >
      <span className="pointer-events-none absolute right-2">
        <ContextMenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </ContextMenuPrimitive.CheckboxItemIndicator>
      </span>
      {props.children}
    </ContextMenuPrimitive.CheckboxItem>
  )
}
