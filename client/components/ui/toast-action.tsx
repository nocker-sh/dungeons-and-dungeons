import { omitProps } from "@/client/utils/omit-props"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { cn } from "cn"
import { Button } from "@/client/components/ui/button"

type Props = ToastPrimitive.Action.Props

export function ToastAction(props: Props) {
  const render =
    props.render === undefined ? (
      <Button variant="outline" size="sm" />
    ) : (
      props.render
    )
  const restProps = omitProps(props, ["className", "render"])

  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      render={render}
      className={cn("shrink-0", props.className)}
      {...restProps}
    />
  )
}
