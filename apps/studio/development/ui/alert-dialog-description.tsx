import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import { cn } from "cn"

type Props = React.ComponentProps<typeof AlertDialogPrimitive.Description>

export function AlertDialogDescription(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        props.className
      )}
      {...restProps}
    />
  )
}
