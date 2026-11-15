import { omitProps } from "@/client/utils/omit-props"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { cn } from "cn"

type Props = ToastPrimitive.Viewport.Props

export function ToastViewport(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-sm outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full",
        props.className
      )}
      {...restProps}
    />
  )
}
