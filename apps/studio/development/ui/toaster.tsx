import { omitProps } from "@/client/utils/omit-props"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { ToastProvider } from "@/development/ui/toast-provider"
import { ToastPortal } from "@/development/ui/toast-portal"
import { ToastViewport } from "@/development/ui/toast-viewport"
import { ToastList } from "@/development/ui/toast-list"

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
