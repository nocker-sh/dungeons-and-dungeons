import { setTimeout as delay } from "node:timers/promises"
import type { Page } from "playwright"

/** フレーム内のrAF・タイマーは仮想時計で止まるため、監視はブラウザの外で行う。 */
export async function waitForStudio(page: Page, timeout = 45000) {
  const deadline = performance.now() + timeout
  while (true) {
    const state = await page.evaluate(() => ({
      ready: window.__devStudio?.ready ?? false,
      error: window.__devStudioError,
    }))
    if (state.ready || state.error) return state
    if (performance.now() >= deadline)
      throw new Error(
        `スタジオの起動が${timeout}ms以内に完了しません: ${page.url()}`
      )
    await delay(20)
  }
}
