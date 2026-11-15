"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

type Props = TooltipPrimitive.Trigger.Props

export function TooltipTrigger(props: Props) {
  const restProps = omitProps(props, [])

  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...restProps} />
}
