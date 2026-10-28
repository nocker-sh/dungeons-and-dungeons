import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function AlertAction(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", props.className)}
      {...restProps}
    />
  )
}
