"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

type Props = PopoverPrimitive.Root.Props

export function Popover(props: Props) {
  const restProps = omitProps(props, [])

  return <PopoverPrimitive.Root data-slot="popover" {...restProps} />
}
