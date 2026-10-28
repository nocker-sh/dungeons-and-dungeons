import type { Page } from "playwright"

/** 要素が画面の中に入り、動きが止まるまで待つ（画面外から飛び込んでくる途中は押せない）。 */
export async function settleInView(
  page: Page,
  target: ReturnType<Page["locator"]>,
  timeout = 20_000
) {
  await target.waitFor({ timeout })
  const viewport = page.viewportSize() ?? { width: 0, height: 0 }
  const until = Date.now() + timeout
  let last = ""
  while (Date.now() < until) {
    const box = await target.boundingBox()
    if (box) {
      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      const key = `${Math.round(box.x)},${Math.round(box.y)}`
      const inside =
        cx > 0 && cy > 0 && cx < viewport.width && cy < viewport.height
      if (inside && key === last) return
      last = key
    }
    await page.waitForTimeout(120)
  }
  throw new Error("画面の中で止まらない")
}
