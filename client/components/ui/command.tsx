import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "cn"

type Props = React.ComponentProps<typeof CommandPrimitive>

export function Command(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground",
        props.className
      )}
      {...restProps}
    />
  )
}
