"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

type Props = DialogPrimitive.Title.Props

export function DialogTitle(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        props.className
      )}
      {...restProps}
    />
  )
}
