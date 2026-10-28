import { omitProps } from "@/client/utils/omit-props"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import { cn } from "cn"
import { AlertDialogPortal } from "@/client/components/ui/alert-dialog-portal"
import { AlertDialogOverlay } from "@/client/components/ui/alert-dialog-overlay"

type Props = AlertDialogPrimitive.Popup.Props & {
  size?: "default" | "sm"
}

export function AlertDialogContent(props: Props) {
  const size = props.size === undefined ? "default" : props.size
  const restProps = omitProps(props, ["className", "size"])

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          "group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          props.className
        )}
        {...restProps}
      />
    </AlertDialogPortal>
  )
}
