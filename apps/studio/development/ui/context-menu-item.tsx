import { omitProps } from "@/client/utils/omit-props"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { cn } from "cn"

type Props = ContextMenuPrimitive.Item.Props & {
  inset?: boolean
  variant?: "default" | "destructive"
}

export function ContextMenuItem(props: Props) {
  const variant = props.variant === undefined ? "default" : props.variant
  const restProps = omitProps(props, ["className", "inset", "variant"])

  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={props.inset}
      data-variant={variant}
      className={cn(
        "group/context-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus:*:[svg]:text-accent-foreground data-[variant=destructive]:*:[svg]:text-destructive",
        props.className
      )}
      {...restProps}
    />
  )
}
