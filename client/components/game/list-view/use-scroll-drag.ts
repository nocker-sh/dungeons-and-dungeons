import { useRef, type PointerEvent, type RefObject } from "react"

/** つまみの移動可能な長さを、一覧のスクロール可能な長さへ対応させる。 */
export function useScrollDrag(
  scroller: RefObject<HTMLElement | null>,
  track: RefObject<HTMLElement | null>
) {
  const drag = useRef<{
    pointerId: number
    y: number
    top: number
    ratio: number
  } | null>(null)
  const finish = (event: PointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0 || drag.current) return
      const element = scroller.current
      const bar = track.current
      if (!element || !bar) return
      const max = element.scrollHeight - element.clientHeight
      const travel =
        bar.getBoundingClientRect().height -
        event.currentTarget.getBoundingClientRect().height
      if (max <= 0 || travel <= 0) return
      event.preventDefault()
      // 取消・領域外への移動・要素の削除もブラウザのcaptureに任せ、全体にlistenerを残さない。
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = {
        pointerId: event.pointerId,
        y: event.clientY,
        top: element.scrollTop,
        ratio: max / travel,
      }
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const start = drag.current
      if (!start || start.pointerId !== event.pointerId || !scroller.current)
        return
      scroller.current.scrollTop =
        start.top + (event.clientY - start.y) * start.ratio
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture: finish,
  }
}
