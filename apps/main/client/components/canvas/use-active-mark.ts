import { useEffect, useState } from "react"
import type { RefObject } from "react"

/**
 * 要素が選択中（キーボード操作の is-active）か。
 * 選択は focus.ts が class で付け外しするので、その変化を見て状態にする（CSS の .is-active の代わり）。
 */
export function useActiveMark(ref: RefObject<Element | null>) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setActive(el.classList.contains("is-active"))
    read()
    const observer = new MutationObserver(read)
    observer.observe(el, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [ref])
  return active
}
