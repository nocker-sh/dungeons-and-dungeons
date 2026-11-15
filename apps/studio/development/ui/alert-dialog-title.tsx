import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import { cn } from "cn"

type Props = React.ComponentProps<typeof AlertDialogPrimitive.Title>

export function AlertDialogTitle(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "font-heading text-base font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        props.className
      )}
      {...restProps}
    />
  )
}
