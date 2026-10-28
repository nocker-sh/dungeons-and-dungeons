"use client"

import { omitProps } from "@/client/utils/omit-props"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { fieldVariants } from "@/client/components/ui/field-variants"

export type Props = React.ComponentProps<"div"> &
  VariantProps<typeof fieldVariants>

export function Field(props: Props) {
  const orientation =
    props.orientation === undefined ? "vertical" : props.orientation
  const restProps = omitProps(props, ["className", "orientation"])

  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), props.className)}
      {...restProps}
    />
  )
}
