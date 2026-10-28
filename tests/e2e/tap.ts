import type { Page } from "playwright"
import { settleInView } from "@/tests/e2e/settle-in-view"

/** 入場を待ち、対象がクリックを受け取れることを確認して押す。 */
export async function tap(page: Page, target: ReturnType<Page["locator"]>) {
  await settleInView(page, target)
  // 脈打つボタンは動き続ける。座標の完全停止ではなく、実際の受け手を確かめる。
  const until = Date.now() + 20_000
  while (Date.now() < until) {
    const point = await target.evaluate((element) => {
      const button = element.closest("button")
      if (button?.matches(":disabled") || element.closest("[inert]"))
        return null
      const box = element.getBoundingClientRect()
      const left = Math.max(0, box.left)
      const right = Math.min(innerWidth, box.right)
      const top = Math.max(0, box.top)
      const bottom = Math.min(innerHeight, box.bottom)
      if (left >= right || top >= bottom) return null
      const x = (left + right) / 2
      const y = (top + bottom) / 2
      const hit = document.elementFromPoint(x, y)
      return hit && element.contains(hit) ? { x, y } : null
    })
    if (!point) {
      await page.waitForTimeout(100)
      continue
    }
    // 確認後に動いてクリックが外れた場合も、成功扱いにしない。
    const receipt = await target.evaluateHandle((element) => {
      const record = () => {
        receipt.clicked = true
      }
      const receipt = {
        clicked: false,
        cleanup: () => element.removeEventListener("click", record, true),
      }
      element.addEventListener("click", record, { capture: true, once: true })
      return receipt
    })
    try {
      await page.mouse.click(point.x, point.y)
      if (!(await receipt.evaluate((value) => value.clicked)))
        throw new Error("クリックが対象に届かなかった")
      return
    } finally {
      await receipt.evaluate((value) => value.cleanup())
      await receipt.dispose()
    }
  }
  throw new Error("対象がクリックを受け取れる状態にならない")
}
