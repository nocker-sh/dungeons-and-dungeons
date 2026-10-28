import type { Page } from "playwright"
import { settleInView } from "@/tests/e2e/settle-in-view"
import { tap } from "@/tests/e2e/tap"

/** aria-label で押す。画面の中で止まるまで待ってから押す。 */
export async function press(page: Page, label: string, settle = 200) {
  const target = page.locator(`[aria-label="${label}"]`).first()
  await settleInView(page, target)
  await page.waitForTimeout(settle)
  await tap(page, target)
}
