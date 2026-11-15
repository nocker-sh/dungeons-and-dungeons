import { omitProps } from "@/client/utils/omit-props"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { cn } from "cn"
import { ChevronRightIcon } from "lucide-react"

type Props = ContextMenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean
}

export function ContextMenuSubTrigger(props: Props) {
  const restProps = omitProps(props, ["className", "inset", "children"])

  return (
    <ContextMenuPrimitive.SubmenuTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={props.inset}
      className={cn(
        "flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        props.className
      )}
      {...restProps}
    >
      {props.children}
      <ChevronRightIcon className="ml-auto" />
    </ContextMenuPrimitive.SubmenuTrigger>
  )
}
