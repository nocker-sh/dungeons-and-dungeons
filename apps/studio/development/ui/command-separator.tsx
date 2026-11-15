import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "cn"

type Props = React.ComponentProps<typeof CommandPrimitive.Separator>

export function CommandSeparator(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-1 h-px bg-border", props.className)}
      {...restProps}
    />
  )
}
