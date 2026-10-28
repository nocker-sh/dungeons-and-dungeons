import { omitProps } from "@/client/utils/omit-props"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { emptyMediaVariants } from "@/client/components/ui/empty-media-variants"

export type Props = React.ComponentProps<"div"> &
  VariantProps<typeof emptyMediaVariants>

export function EmptyMedia(props: Props) {
  const variant = props.variant === undefined ? "default" : props.variant
  const restProps = omitProps(props, ["className", "variant"])

  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(
        emptyMediaVariants({ variant, className: props.className })
      )}
      {...restProps}
    />
  )
}
