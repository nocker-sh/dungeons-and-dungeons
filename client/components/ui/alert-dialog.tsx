import { omitProps } from "@/client/utils/omit-props"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"

type Props = AlertDialogPrimitive.Root.Props

export function AlertDialog(props: Props) {
  const restProps = omitProps(props, [])

  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...restProps} />
}
