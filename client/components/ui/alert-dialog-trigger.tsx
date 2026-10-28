import { omitProps } from "@/client/utils/omit-props"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"

type Props = AlertDialogPrimitive.Trigger.Props

export function AlertDialogTrigger(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <AlertDialogPrimitive.Trigger
      data-slot="alert-dialog-trigger"
      {...restProps}
    />
  )
}
