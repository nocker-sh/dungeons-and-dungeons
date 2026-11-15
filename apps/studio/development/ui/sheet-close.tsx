"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"

type Props = SheetPrimitive.Close.Props

export function SheetClose(props: Props) {
  const restProps = omitProps(props, [])

  return <SheetPrimitive.Close data-slot="sheet-close" {...restProps} />
}
