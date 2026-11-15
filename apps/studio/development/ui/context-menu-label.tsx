import { omitProps } from "@/client/utils/omit-props"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { cn } from "cn"

type Props = ContextMenuPrimitive.GroupLabel.Props & {
  inset?: boolean
}

export function ContextMenuLabel(props: Props) {
  const restProps = omitProps(props, ["className", "inset"])

  return (
    <ContextMenuPrimitive.GroupLabel
      data-slot="context-menu-label"
      data-inset={props.inset}
      className={cn(
        "px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7",
        props.className
      )}
      {...restProps}
    />
  )
}
