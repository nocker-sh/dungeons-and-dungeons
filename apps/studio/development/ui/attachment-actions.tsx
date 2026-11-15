import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function AttachmentActions(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="attachment-actions"
      className={cn(
        "relative z-20 flex shrink-0 items-center group-data-[orientation=vertical]/attachment:absolute group-data-[orientation=vertical]/attachment:top-3 group-data-[orientation=vertical]/attachment:right-3 group-data-[orientation=vertical]/attachment:gap-1",
        props.className
      )}
      {...restProps}
    />
  )
}
