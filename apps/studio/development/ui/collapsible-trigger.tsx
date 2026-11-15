"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

type Props = CollapsiblePrimitive.Trigger.Props

export function CollapsibleTrigger(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      {...restProps}
    />
  )
}
