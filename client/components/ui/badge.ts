import { omitProps } from "@/client/utils/omit-props"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { badgeVariants } from "@/client/components/ui/badge-variants"

export type Props = useRender.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>

export function Badge(props: Props) {
  const variant = props.variant === undefined ? "default" : props.variant
  const restProps = omitProps(props, ["className", "variant", "render"])

  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), props.className),
      },
      restProps
    ),
    render: props.render,
    state: {
      slot: "badge",
      variant,
    },
  })
}
