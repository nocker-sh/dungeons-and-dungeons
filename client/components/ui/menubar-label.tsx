import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { DropdownMenuLabel } from "@/client/components/ui/dropdown-menu-label"

type Props = React.ComponentProps<typeof DropdownMenuLabel> & {
  inset?: boolean
}

export function MenubarLabel(props: Props) {
  const restProps = omitProps(props, ["className", "inset"])

  return (
    <DropdownMenuLabel
      data-slot="menubar-label"
      data-inset={props.inset}
      className={cn(
        "px-1.5 py-1 text-sm font-medium data-inset:pl-7",
        props.className
      )}
      {...restProps}
    />
  )
}
