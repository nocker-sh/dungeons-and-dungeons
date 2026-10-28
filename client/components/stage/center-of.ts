/** 要素の中心を view 基準の座標で返す。 */
export function centerOf(el: Element | null, view: Element | null, fy = 0.5) {
  if (!el || !view) return { x: 0, y: 0, w: 0, h: 0 }
  const r = el.getBoundingClientRect()
  const v = view.getBoundingClientRect()
  return {
    x: r.left - v.left + r.width / 2,
    y: r.top - v.top + r.height * fy,
    w: r.width,
    h: r.height,
  }
}
