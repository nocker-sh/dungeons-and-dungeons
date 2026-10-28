"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

type Props = CollapsiblePrimitive.Root.Props

export function Collapsible(props: Props) {
  const restProps = omitProps(props, [])

  return <CollapsiblePrimitive.Root data-slot="collapsible" {...restProps} />
}
