import { omitProps } from "@/client/utils/omit-props"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import { cn } from "cn"

type Props = AlertDialogPrimitive.Backdrop.Props

export function AlertDialogOverlay(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        props.className
      )}
      {...restProps}
    />
  )
}
