import { omitProps } from "@/client/utils/omit-props"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"

type Props = ToastPrimitive.Portal.Props

export function ToastPortal(props: Props) {
  const restProps = omitProps(props, [])

  return <ToastPrimitive.Portal data-slot="toast-portal" {...restProps} />
}
