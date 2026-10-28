import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function CardDescription(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", props.className)}
      {...restProps}
    />
  )
}
