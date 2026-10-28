"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

type Props = CollapsiblePrimitive.Panel.Props

export function CollapsibleContent(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      {...restProps}
    />
  )
}
