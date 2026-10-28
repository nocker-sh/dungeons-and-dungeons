import type { Page } from "playwright"
import { settleInView } from "@/tests/e2e/settle-in-view"

/** 狙っている敵（押すと選んでいるワザを放つ）。 */
export const FIRE = '[data-action="放つ"]'

/**
 * 狙っている敵を押して、選んでいるワザを放つ。
 * 敵の絵は大きく、真ん中に指示の板が重なることがあるので、押して敵に当たる場所（中心に近い順）を押す。
 */
export async function fire(page: Page, settle = 200) {
  const target = page.locator(FIRE).first()
  await settleInView(page, target)
  await page.waitForTimeout(settle)
  const point = await target.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const left = Math.max(0, box.left)
    const right = Math.min(innerWidth, box.right)
    const top = Math.max(0, box.top)
    const bottom = Math.min(innerHeight, box.bottom)
    const center = { x: (left + right) / 2, y: (top + bottom) / 2 }
    const points: { x: number; y: number }[] = []
    for (let row = 1; row < 12; row++)
      for (let column = 1; column < 12; column++)
        points.push({
          x: left + ((right - left) * column) / 12,
          y: top + ((bottom - top) * row) / 12,
        })
    points.sort(
      (a, b) =>
        Math.hypot(a.x - center.x, a.y - center.y) -
        Math.hypot(b.x - center.x, b.y - center.y)
    )
    const found = [center, ...points].find((point) =>
      element.contains(document.elementFromPoint(point.x, point.y))
    )
    // 押せないときは、敵を覆っている物を失敗の文に出す
    const covers = new Set(
      [center, ...points].map((point) => {
        const cover = document.elementFromPoint(point.x, point.y)
        return cover
          ? `${cover.tagName}.${cover.className} ${cover.closest("[aria-label]")?.getAttribute("aria-label") ?? ""}`
          : "なし"
      })
    )
    return { found, cover: [...covers].slice(0, 4).join(" / ") }
  })
  if (!point.found) {
    await page.screenshot({ path: "/tmp/dnd-fire-failure.png" })
    throw new Error(`狙っている敵に押せる場所がない（真ん中: ${point.cover}）`)
  }
  await page.mouse.click(point.found.x, point.found.y)
}
