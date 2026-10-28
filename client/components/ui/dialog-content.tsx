"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"
import { Button } from "@/client/components/ui/button"
import { XIcon } from "lucide-react"
import { DialogPortal } from "@/client/components/ui/dialog-portal"
import { DialogOverlay } from "@/client/components/ui/dialog-overlay"

type Props = DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}

export function DialogContent(props: Props) {
  const showCloseButton =
    props.showCloseButton === undefined ? true : props.showCloseButton
  const restProps = omitProps(props, [
    "className",
    "children",
    "showCloseButton",
  ])

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          props.className
        )}
        {...restProps}
      >
        {props.children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}
