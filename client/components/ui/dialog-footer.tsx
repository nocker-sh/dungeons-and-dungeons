"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"
import { Button } from "@/client/components/ui/button"

type Props = React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}

export function DialogFooter(props: Props) {
  const showCloseButton =
    props.showCloseButton === undefined ? false : props.showCloseButton
  const restProps = omitProps(props, [
    "className",
    "showCloseButton",
    "children",
  ])

  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        props.className
      )}
      {...restProps}
    >
      {props.children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}
