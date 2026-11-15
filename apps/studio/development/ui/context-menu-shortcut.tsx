import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"span">

export function ContextMenuShortcut(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-focus/context-menu-item:text-accent-foreground",
        props.className
      )}
      {...restProps}
    />
  )
}
