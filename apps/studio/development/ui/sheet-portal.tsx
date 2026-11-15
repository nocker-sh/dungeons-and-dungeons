"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"

type Props = SheetPrimitive.Portal.Props

export function SheetPortal(props: Props) {
  const restProps = omitProps(props, [])

  return <SheetPrimitive.Portal data-slot="sheet-portal" {...restProps} />
}
