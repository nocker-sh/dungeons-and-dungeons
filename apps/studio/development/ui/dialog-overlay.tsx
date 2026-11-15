"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

type Props = DialogPrimitive.Backdrop.Props

export function DialogOverlay(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        props.className
      )}
      {...restProps}
    />
  )
}
