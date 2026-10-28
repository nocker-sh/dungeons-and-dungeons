import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function CardContent(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", props.className)}
      {...restProps}
    />
  )
}
