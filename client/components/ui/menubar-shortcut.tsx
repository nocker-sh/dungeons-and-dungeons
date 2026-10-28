import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { DropdownMenuShortcut } from "@/client/components/ui/dropdown-menu-shortcut"

type Props = React.ComponentProps<typeof DropdownMenuShortcut>

export function MenubarShortcut(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <DropdownMenuShortcut
      data-slot="menubar-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-focus/menubar-item:text-accent-foreground",
        props.className
      )}
      {...restProps}
    />
  )
}
