import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function CardAction(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        props.className
      )}
      {...restProps}
    />
  )
}
