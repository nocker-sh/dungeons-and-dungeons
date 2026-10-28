import * as React from "react"
import { omitProps } from "@/client/utils/omit-props"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { attachmentMediaVariants } from "@/client/components/ui/attachment-media-variants"

export type Props = React.ComponentProps<"div"> &
  VariantProps<typeof attachmentMediaVariants>

export function AttachmentMedia(props: Props) {
  const variant = props.variant === undefined ? "icon" : props.variant
  const restProps = omitProps(props, ["className", "variant"])

  return (
    <div
      data-slot="attachment-media"
      data-variant={variant}
      className={cn(attachmentMediaVariants({ variant }), props.className)}
      {...restProps}
    />
  )
}
