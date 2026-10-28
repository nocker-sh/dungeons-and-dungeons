import * as React from "react"
import { omitProps } from "@/client/utils/omit-props"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Button } from "@/client/components/ui/button"
import { inputGroupButtonVariants } from "@/client/components/ui/input-group-button-variants"

export type Props = Omit<React.ComponentProps<typeof Button>, "size" | "type"> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: "button" | "submit" | "reset"
  }

export function InputGroupButton(props: Props) {
  const type = props.type === undefined ? "button" : props.type
  const variant = props.variant === undefined ? "ghost" : props.variant
  const size = props.size === undefined ? "xs" : props.size
  const restProps = omitProps(props, ["className", "type", "variant", "size"])

  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), props.className)}
      {...restProps}
    />
  )
}
