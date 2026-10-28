"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"

type Props = ComboboxPrimitive.Collection.Props

export function ComboboxCollection(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <ComboboxPrimitive.Collection
      data-slot="combobox-collection"
      {...restProps}
    />
  )
}
