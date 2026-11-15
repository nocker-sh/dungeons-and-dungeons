"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"

type Props = SheetPrimitive.Trigger.Props

export function SheetTrigger(props: Props) {
  const restProps = omitProps(props, [])

  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...restProps} />
}
