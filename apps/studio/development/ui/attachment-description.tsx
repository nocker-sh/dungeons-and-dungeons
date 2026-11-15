import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"span">

export function AttachmentDescription(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <span
      data-slot="attachment-description"
      className={cn(
        "mt-0.5 block min-w-0 truncate text-xs text-muted-foreground group-data-[state=error]/attachment:text-destructive/80",
        "max-w-full",
        props.className
      )}
      {...restProps}
    />
  )
}
