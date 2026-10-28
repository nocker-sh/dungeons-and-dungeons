"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"

type Props = ComboboxPrimitive.Value.Props

export function ComboboxValue(props: Props) {
  const restProps = omitProps(props, [])

  return <ComboboxPrimitive.Value data-slot="combobox-value" {...restProps} />
}
