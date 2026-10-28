import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "cn"

type Props = React.ComponentProps<typeof CommandPrimitive.Group>

export function CommandGroup(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-1 text-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground",
        props.className
      )}
      {...restProps}
    />
  )
}
