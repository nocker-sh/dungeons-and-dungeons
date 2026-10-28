import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { Toast } from "@/client/components/ui/toast"
import { ToastContent } from "@/client/components/ui/toast-content"
import { ToastIcon } from "@/client/components/ui/toast-icon"
import { ToastTitle } from "@/client/components/ui/toast-title"
import { ToastDescription } from "@/client/components/ui/toast-description"
import { ToastAction } from "@/client/components/ui/toast-action"
import { ToastClose } from "@/client/components/ui/toast-close"

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
