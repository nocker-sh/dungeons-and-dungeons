import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function MessageGroup(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="message-group"
      className={cn("flex min-w-0 flex-col gap-2", props.className)}
      {...restProps}
    />
  )
}
