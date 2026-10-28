import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "cn"

type Props = React.ComponentProps<typeof CommandPrimitive.List>

export function CommandList(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none",
        props.className
      )}
      {...restProps}
    />
  )
}
