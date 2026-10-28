import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function ItemFooter(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="item-footer"
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        props.className
      )}
      {...restProps}
    />
  )
}
