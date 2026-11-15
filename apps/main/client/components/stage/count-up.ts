import { tween } from "@/client/components/canvas/tween"

/** 数字を数え上げる。毎フレーム React を再描画しないよう、要素へ直接書く。 */
export function countUp(
  el: HTMLElement | null,
  from: number,
  to: number,
  ms: number
) {
  if (el) el.textContent = String(from)
  return tween(
    from,
    to,
    ms,
    (value) => {
      if (el) el.textContent = String(Math.round(value))
    },
    { ease: (value) => 1 - Math.pow(1 - value, 3) }
  )
}
