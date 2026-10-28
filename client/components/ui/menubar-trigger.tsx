import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { DropdownMenuTrigger } from "@/client/components/ui/dropdown-menu-trigger"

type Props = React.ComponentProps<typeof DropdownMenuTrigger>

export function MenubarTrigger(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <DropdownMenuTrigger
      data-slot="menubar-trigger"
      className={cn(
        "flex items-center rounded-sm px-1.5 py-[2px] text-sm font-medium outline-hidden select-none hover:bg-muted aria-expanded:bg-muted",
        props.className
      )}
      {...restProps}
    />
  )
}
