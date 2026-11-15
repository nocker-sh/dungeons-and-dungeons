import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { Toast } from "@/development/ui/toast"
import { ToastContent } from "@/development/ui/toast-content"
import { ToastIcon } from "@/development/ui/toast-icon"
import { ToastTitle } from "@/development/ui/toast-title"
import { ToastDescription } from "@/development/ui/toast-description"
import { ToastAction } from "@/development/ui/toast-action"
import { ToastClose } from "@/development/ui/toast-close"

export function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()

  return toasts.map((toastItem) => (
    <Toast key={toastItem.id} toast={toastItem}>
      <ToastContent>
        <ToastIcon type={toastItem.type} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ToastTitle />
          <ToastDescription />
        </div>
        <ToastAction />
        <ToastClose />
      </ToastContent>
    </Toast>
  ))
}
