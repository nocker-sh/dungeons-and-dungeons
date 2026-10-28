import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { Button } from "@/client/components/ui/button"

type Props = React.ComponentProps<typeof Button>

export function AttachmentAction(props: Props) {
  const size = props.size === undefined ? "icon-xs" : props.size
  const restProps = omitProps(props, ["className", "variant", "size"])

  return (
    <Button
      data-slot="attachment-action"
      variant={props.variant ?? "ghost"}
      size={size}
      className={cn(props.className)}
      {...restProps}
    />
  )
}
