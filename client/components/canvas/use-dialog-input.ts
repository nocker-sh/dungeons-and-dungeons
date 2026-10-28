import {
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from "react"

const CONTROLS =
  'button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled)'

/** 入力欄のある編集画面。Tabは画面内、Escは編集取消。変換中のEscはIMEへ渡す。 */
export function useDialogInput(
  dialog: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocus = CONTROLS
) {
  const composing = useRef(false)
  useLayoutEffect(() => {
    const opener = document.activeElement
    const first = dialog.current?.querySelector<HTMLElement>(initialFocus)
    ;(first ?? dialog.current)?.focus({ preventScroll: true })
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true })
    }
  }, [dialog, initialFocus])

  return {
    onCompositionStart: () => {
      composing.current = true
    },
    onCompositionEnd: () => {
      composing.current = false
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === "Tab") {
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(CONTROLS),
        ]
        event.preventDefault()
        const index = controls.indexOf(document.activeElement as HTMLElement)
        const next =
          index < 0
            ? event.shiftKey
              ? controls.length - 1
              : 0
            : (index + (event.shiftKey ? -1 : 1) + controls.length) %
              controls.length
        ;(controls[next] ?? event.currentTarget).focus({ preventScroll: true })
      }
      if (event.key !== "Escape") return
      if (
        composing.current ||
        event.nativeEvent.isComposing ||
        event.nativeEvent.keyCode === 229
      )
        return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    },
  }
}
