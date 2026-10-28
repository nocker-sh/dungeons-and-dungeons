import { omitProps } from "@/client/utils/omit-props"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { cn } from "cn"

type Props = ToastPrimitive.Title.Props

export function ToastTitle(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-sm font-medium", props.className)}
      {...restProps}
    />
  )
}
