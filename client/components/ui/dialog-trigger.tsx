"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

type Props = DialogPrimitive.Trigger.Props

export function DialogTrigger(props: Props) {
  const restProps = omitProps(props, [])

  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...restProps} />
}
