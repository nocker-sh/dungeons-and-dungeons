import { omitProps } from "@/client/utils/omit-props"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { markerVariants } from "@/client/components/ui/marker-variants"

export type Props = useRender.ComponentProps<"div"> &
  VariantProps<typeof markerVariants>

export function Marker(props: Props) {
  const variant = props.variant === undefined ? "default" : props.variant
  const restProps = omitProps(props, ["className", "variant", "render"])

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(markerVariants({ variant, className: props.className })),
      },
      restProps
    ),
    render: props.render,
    state: {
      slot: "marker",
      variant,
    },
  })
}
