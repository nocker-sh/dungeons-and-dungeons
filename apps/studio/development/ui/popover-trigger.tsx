"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

type Props = PopoverPrimitive.Trigger.Props

export function PopoverTrigger(props: Props) {
  const restProps = omitProps(props, [])

  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...restProps} />
}
