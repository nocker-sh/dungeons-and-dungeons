import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"span">

export function DropdownMenuShortcut(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground",
        props.className
      )}
      {...restProps}
    />
  )
}
