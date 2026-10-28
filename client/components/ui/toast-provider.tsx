import { omitProps } from "@/client/utils/omit-props"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"

type Props = ToastPrimitive.Provider.Props

export function ToastProvider(props: Props) {
  const restProps = omitProps(props, [])

  return <ToastPrimitive.Provider {...restProps} />
}
