"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

type Props = DialogPrimitive.Root.Props

export function Dialog(props: Props) {
  const restProps = omitProps(props, [])

  return <DialogPrimitive.Root data-slot="dialog" {...restProps} />
}
