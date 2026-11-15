"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

type Props = TooltipPrimitive.Provider.Props

export function TooltipProvider(props: Props) {
  const delay = props.delay === undefined ? 0 : props.delay
  const restProps = omitProps(props, ["delay"])

  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...restProps}
    />
  )
}
