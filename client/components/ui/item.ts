import { omitProps } from "@/client/utils/omit-props"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { itemVariants } from "@/client/components/ui/item-variants"

export type Props = useRender.ComponentProps<"div"> &
  VariantProps<typeof itemVariants>

export function Item(props: Props) {
  const variant = props.variant === undefined ? "default" : props.variant
  const size = props.size === undefined ? "default" : props.size
  const restProps = omitProps(props, ["className", "variant", "size", "render"])

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          itemVariants({ variant, size, className: props.className })
        ),
      },
      restProps
    ),
    render: props.render,
    state: {
      slot: "item",
      variant,
      size,
    },
  })
}
