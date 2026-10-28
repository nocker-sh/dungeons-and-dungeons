import * as React from "react"
import { omitProps } from "@/client/utils/omit-props"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { alertVariants } from "@/client/components/ui/alert-variants"

export type Props = React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants>

export function Alert(props: Props) {
  const restProps = omitProps(props, ["className", "variant"])

  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant: props.variant }), props.className)}
      {...restProps}
    />
  )
}
