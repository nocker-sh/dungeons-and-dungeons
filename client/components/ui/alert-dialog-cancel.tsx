import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import { cn } from "cn"
import { Button } from "@/client/components/ui/button"

type Props = AlertDialogPrimitive.Close.Props &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">

export function AlertDialogCancel(props: Props) {
  const variant = props.variant === undefined ? "outline" : props.variant
  const size = props.size === undefined ? "default" : props.size
  const restProps = omitProps(props, ["className", "variant", "size"])

  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      className={cn(props.className)}
      render={<Button variant={variant} size={size} />}
      {...restProps}
    />
  )
}
