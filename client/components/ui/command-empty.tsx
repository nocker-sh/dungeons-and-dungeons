import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "cn"

type Props = React.ComponentProps<typeof CommandPrimitive.Empty>

export function CommandEmpty(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm", props.className)}
      {...restProps}
    />
  )
}
