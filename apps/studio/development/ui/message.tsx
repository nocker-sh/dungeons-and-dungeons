import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div"> & { align?: "start" | "end" }

export function Message(props: Props) {
  const align = props.align === undefined ? "start" : props.align
  const restProps = omitProps(props, ["className", "align"])

  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse",
        props.className
      )}
      {...restProps}
    />
  )
}
