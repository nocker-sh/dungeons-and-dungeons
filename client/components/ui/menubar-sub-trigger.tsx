import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { DropdownMenuSubTrigger } from "@/client/components/ui/dropdown-menu-sub-trigger"

type Props = React.ComponentProps<typeof DropdownMenuSubTrigger> & {
  inset?: boolean
}

export function MenubarSubTrigger(props: Props) {
  const restProps = omitProps(props, ["className", "inset"])

  return (
    <DropdownMenuSubTrigger
      data-slot="menubar-sub-trigger"
      data-inset={props.inset}
      className={cn(
        "gap-1.5 rounded-md px-1.5 py-1 text-sm focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-open:bg-accent data-open:text-accent-foreground [&_svg:not([class*='size-'])]:size-4",
        props.className
      )}
      {...restProps}
    />
  )
}
