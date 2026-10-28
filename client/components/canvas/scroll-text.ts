import type { KeyboardEvent } from "react"

/** 読むための欄。スクロールキーとEnterを背面のゲーム操作へ流さない。 */
export function scrollText(event: KeyboardEvent<HTMLElement>) {
  if (
    event.target !== event.currentTarget ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return
  const area = event.currentTarget
  const distance = {
    ArrowUp: -40,
    ArrowDown: 40,
    PageUp: -area.clientHeight,
    PageDown: area.clientHeight,
    " ": area.clientHeight * (event.shiftKey ? -1 : 1),
  }[event.key]
  if (distance !== undefined) {
    event.preventDefault()
    area.scrollBy({ top: distance })
  } else if (event.key === "Home" || event.key === "End") {
    event.preventDefault()
    area.scrollTop = event.key === "Home" ? 0 : area.scrollHeight
  } else if (event.key === "Enter") event.preventDefault()
}
