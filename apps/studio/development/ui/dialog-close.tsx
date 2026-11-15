"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

type Props = DialogPrimitive.Close.Props

export function DialogClose(props: Props) {
  const restProps = omitProps(props, [])

  return <DialogPrimitive.Close data-slot="dialog-close" {...restProps} />
}
