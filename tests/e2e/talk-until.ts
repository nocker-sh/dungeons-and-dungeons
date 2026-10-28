import type { Page } from "playwright"
import { tap } from "@/tests/e2e/tap"

/**
 * 会話を実UIで進め（選択肢は先頭）、会話が終わって目当ての物が出るまで待つ。
 * はじめから遊ぶ流れのように、会話と場面の切り替えが自動で続く所で使う。
 */
export async function talkUntil(
  page: Page,
  target: ReturnType<Page["locator"]>,
  timeout = 90_000
) {
  const dialog = page.locator("[data-conversation-dialog]")
  const until = Date.now() + timeout
  while (Date.now() < until) {
    const talking = await dialog.count()
    // 会話は続けて流れることがあるので、少し待っても次の会話が始まらないことを確かめる
    if (!talking && (await target.count())) {
      await page.waitForTimeout(1200)
      if (!(await dialog.count()) && (await target.count())) return
      continue
    }
    if (talking) {
      const confirm = dialog.locator('[role="group"] button').first()
      const next = dialog.getByRole("button", {
        name: "会話を進める",
        exact: true,
      })
      // 選択肢は滑り込んでくるので、画面の中で止まってから押す
      if (await confirm.count()) await tap(page, confirm)
      // 会話の終了と競合して消えるボタンを、別の呼び出しで待ち直さない。
      else if (
        await next.evaluateAll((buttons) =>
          buttons.some((button) => !button.matches(":disabled"))
        )
      )
        await page.keyboard.press("Enter")
    }
    await page.waitForTimeout(150)
  }
  throw new Error("会話を進めても出てこない")
}
