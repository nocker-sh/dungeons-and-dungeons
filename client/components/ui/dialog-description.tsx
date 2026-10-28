"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

type Props = DialogPrimitive.Description.Props

export function DialogDescription(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        props.className
      )}
      {...restProps}
    />
  )
}
