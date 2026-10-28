import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function ItemActions(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="item-actions"
      className={cn("flex items-center gap-2", props.className)}
      {...restProps}
    />
  )
}
