"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

type Props = DialogPrimitive.Portal.Props

export function DialogPortal(props: Props) {
  const restProps = omitProps(props, [])

  return <DialogPrimitive.Portal data-slot="dialog-portal" {...restProps} />
}
