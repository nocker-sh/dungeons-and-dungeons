import { omitProps } from "@/client/utils/omit-props"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { cn } from "cn"

type Props = ToastPrimitive.Description.Props

export function ToastDescription(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-sm text-muted-foreground", props.className)}
      {...restProps}
    />
  )
}
