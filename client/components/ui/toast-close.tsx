import { omitProps } from "@/client/utils/omit-props"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { cn } from "cn"
import { Button } from "@/client/components/ui/button"
import { XIcon } from "lucide-react"

type Props = ToastPrimitive.Close.Props

export function ToastClose(props: Props) {
  const render =
    props.render === undefined ? (
      <Button variant="ghost" size="icon-sm" />
    ) : (
      props.render
    )
  const restProps = omitProps(props, ["className", "children", "render"])

  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Close toast"
      render={render}
      className={cn(
        "relative shrink-0 text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:text-foreground",
        props.className
      )}
      {...restProps}
    >
      {props.children ?? <XIcon aria-hidden="true" />}
    </ToastPrimitive.Close>
  )
}
