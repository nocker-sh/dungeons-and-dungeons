"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"

type Props = SheetPrimitive.Root.Props

export function Sheet(props: Props) {
  const restProps = omitProps(props, [])

  return <SheetPrimitive.Root data-slot="sheet" {...restProps} />
}
