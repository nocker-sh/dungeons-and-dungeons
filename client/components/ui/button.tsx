import { omitProps } from "@/client/utils/omit-props"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { buttonVariants } from "@/client/components/ui/button-variants"

export type Props = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>

export function Button(props: Props) {
  const variant = props.variant === undefined ? "default" : props.variant
  const size = props.size === undefined ? "default" : props.size
  const restProps = omitProps(props, ["className", "variant", "size"])

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size, className: props.className })
      )}
      {...restProps}
    />
  )
}
