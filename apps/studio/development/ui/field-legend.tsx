"use client"

import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"

type Props = React.ComponentProps<"legend"> & { variant?: "legend" | "label" }

export function FieldLegend(props: Props) {
  const variant = props.variant === undefined ? "legend" : props.variant
  const restProps = omitProps(props, ["className", "variant"])

  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "mb-1.5 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base",
        props.className
      )}
      {...restProps}
    />
  )
}
