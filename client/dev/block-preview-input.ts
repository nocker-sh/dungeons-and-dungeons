/** 台本のプログラム操作は保ち、人のクリック・キー・ゲームパッドだけを無効にする。 */
export function blockPreviewInput(): () => void {
  const events = [
    "click",
    "dblclick",
    "pointerover",
    "pointerout",
    "pointermove",
    "pointerenter",
    "pointerleave",
    "mouseover",
    "mouseout",
    "pointerdown",
    "pointerup",
    "touchstart",
    "touchend",
    "keydown",
    "keyup",
    "wheel",
    "contextmenu",
  ]
  const block = (event: Event) => {
    if (!event.isTrusted) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  for (const event of events)
    window.addEventListener(event, block, { capture: true, passive: false })
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "getGamepads")
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => [],
  })
  return () => {
    for (const event of events) window.removeEventListener(event, block, true)
    if (descriptor) Object.defineProperty(navigator, "getGamepads", descriptor)
    else Reflect.deleteProperty(navigator, "getGamepads")
  }
}
