"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

type Props = TooltipPrimitive.Root.Props

export function Tooltip(props: Props) {
  const restProps = omitProps(props, [])

  return <TooltipPrimitive.Root data-slot="tooltip" {...restProps} />
}
