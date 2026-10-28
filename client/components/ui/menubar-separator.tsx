import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { DropdownMenuSeparator } from "@/client/components/ui/dropdown-menu-separator"

type Props = React.ComponentProps<typeof DropdownMenuSeparator>

export function MenubarSeparator(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <DropdownMenuSeparator
      data-slot="menubar-separator"
      className={cn("-mx-1 my-1 h-px bg-border", props.className)}
      {...restProps}
    />
  )
}
