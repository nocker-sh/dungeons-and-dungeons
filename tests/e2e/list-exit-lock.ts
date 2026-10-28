import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({ scene: "guild-recruits", width, duration: 12000 })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    await page.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(4500)
      const game = runtime.game!
      const saved = game.save()
      const issue = game.restore({
        ...saved,
        snapshot: { ...saved.snapshot, gold: 10000 },
      })
      if (issue) throw issue
    })
    const reroll = page.getByRole("button", { name: /G で募集を入れ替える/ })
    const price = Number((await reroll.innerText()).match(/\d+/)![0])
    await page.screenshot({ path: `/tmp/dnd-recruits-fixed-${width}.png` })
    await reroll.click()
    const before = await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).game!.save()
    )
    assert.equal(before.snapshot.gold, 10000 - price, "通常の入れ替えは使える")

    await page
      .locator(".listview")
      .getByRole("button", { name: "‹ 戻る" })
      .click()
    // 退場アニメーションが終わる前もDOMは残る。共通のパッド操作と同じclickで確認。
    await reroll.evaluate((button: HTMLButtonElement) => button.click())
    const after = await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).game!.save()
    )
    assert.deepEqual(after, before, "一覧の退場中に募集料・募集内容が変わった")
    assert.equal(await reroll.isDisabled(), true)
    const rows = page.locator(".listview .row")
    assert.ok((await rows.count()) > 0, "退場中の一覧を検証できていない")
    for (const row of await rows.all())
      assert.equal(await row.isDisabled(), true)
    await page.evaluate(async () => window.__devStudio!.advance(6000))
    assert.equal(await page.locator(".listview").count(), 0)
    await page.getByRole("button", { name: "募集", exact: true }).click()
    await page.evaluate(async () => window.__devStudio!.advance(7500))
    const reopenedPrice = Number((await reroll.innerText()).match(/\d+/)![0])
    await reroll.click()
    assert.equal(
      await page.evaluate(
        () => (window.__devStudio as StudioRuntime).game!.state.gold
      ),
      before.snapshot.gold - reopenedPrice,
      "開き直した一覧の入れ替えが使えない"
    )
    console.log(
      `${width}: 募集入替のクリック・退場中の資産保持・行ロック・再開 OK`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
