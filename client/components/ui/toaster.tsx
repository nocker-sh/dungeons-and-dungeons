import { omitProps } from "@/client/utils/omit-props"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { ToastProvider } from "@/client/components/ui/toast-provider"
import { ToastPortal } from "@/client/components/ui/toast-portal"
import { ToastViewport } from "@/client/components/ui/toast-viewport"
import { ToastList } from "@/client/components/ui/toast-list"

export const toast = ToastPrimitive.createToastManager()

type Props = ToastPrimitive.Provider.Props

export function Toaster(props: Props) {
  const toastManager =
    props.toastManager === undefined ? toast : props.toastManager
  const restProps = omitProps(props, ["children", "toastManager"])

  return (
    <ToastProvider toastManager={toastManager} {...restProps}>
      {props.children}
      <ToastPortal>
        <ToastViewport>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  )
}
