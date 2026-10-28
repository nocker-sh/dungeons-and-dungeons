import * as React from "react"
import { omitProps } from "@/client/utils/omit-props"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { attachmentVariants } from "@/client/components/ui/attachment-variants"

export type Props = React.ComponentProps<"div"> &
  VariantProps<typeof attachmentVariants> & {
    state?: "idle" | "uploading" | "processing" | "error" | "done"
  }

export function Attachment(props: Props) {
  const state = props.state === undefined ? "done" : props.state
  const size = props.size === undefined ? "default" : props.size
  const orientation =
    props.orientation === undefined ? "horizontal" : props.orientation
  const restProps = omitProps(props, [
    "className",
    "state",
    "size",
    "orientation",
  ])

  return (
    <div
      data-slot="attachment"
      data-state={state}
      data-size={size}
      data-orientation={orientation}
      className={cn(attachmentVariants({ size, orientation }), props.className)}
      {...restProps}
    />
  )
}
