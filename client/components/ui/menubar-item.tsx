import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { DropdownMenuItem } from "@/client/components/ui/dropdown-menu-item"

type Props = React.ComponentProps<typeof DropdownMenuItem>

export function MenubarItem(props: Props) {
  const variant = props.variant === undefined ? "default" : props.variant
  const restProps = omitProps(props, ["className", "inset", "variant"])

  return (
    <DropdownMenuItem
      data-slot="menubar-item"
      data-inset={props.inset}
      data-variant={variant}
      className={cn(
        "group/menubar-item gap-1.5 rounded-md px-1.5 py-1 text-sm focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive!",
        props.className
      )}
      {...restProps}
    />
  )
}
