import { omitProps } from "@/client/utils/omit-props"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"

type Props = AlertDialogPrimitive.Portal.Props

export function AlertDialogPortal(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <AlertDialogPrimitive.Portal
      data-slot="alert-dialog-portal"
      {...restProps}
    />
  )
}
