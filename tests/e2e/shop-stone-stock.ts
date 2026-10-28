import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import goods from "@/content/data/goods.json"

const stone = goods.find((good) => good.slug === "stone")!
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "shop-tools",
            width,
            height: 844,
            duration: 15000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const before = await page.evaluate(async (price) => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(3500)
      const game = runtime.game!
      const saved = game.save()
      const issue = game.restore({
        ...saved,
        snapshot: { ...saved.snapshot, stones: 7, gold: price },
      })
      if (issue) throw issue
      return game.save()
    }, stone.price!)
    await page.getByRole("button", { name: "購入", exact: true }).click()
    await page.evaluate(async () => window.__devStudio!.advance(4500))
    const row = page.getByRole("button", { name: stone.name, exact: true })
    assert.ok(
      (await row.innerText()).includes("所持 7"),
      "購入前の所持数が残高と違う"
    )
    await row.click()
    await page.evaluate(async () => window.__devStudio!.advance(5500))
    const buy = page.getByRole("button", {
      name: `${stone.price}G で買う`,
      exact: true,
    })
    await buy.focus()
    await page.keyboard.press("Shift+Tab")
    const detail = page.getByRole("region", {
      name: "選んだ品の詳細",
      exact: true,
    })
    assert.equal(
      await detail.evaluate((el) => el === document.activeElement),
      true,
      "購入ボタンから説明欄へ戻れる"
    )
    for (const key of [
      "Space",
      "Enter",
      "ArrowDown",
      "ArrowUp",
      "PageDown",
      "PageUp",
      "End",
      "Home",
    ])
      await page.keyboard.press(key)
    await page.evaluate(async () => window.__devStudio!.advance(6000))
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      before,
      "説明を読むキーで購入しない"
    )
    assert.equal(
      await detail.evaluate((el) => el === document.activeElement),
      true
    )
    await page
      .getByRole("button", { name: `${stone.price}G で買う`, exact: true })
      .click()
    await page.evaluate(async () => window.__devStudio!.advance(6500))
    const after = await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).game!.save()
    )
    assert.deepEqual(
      after.snapshot,
      { ...before.snapshot, stones: 8, gold: 0 },
      "石と代金以外が変わった"
    )
    assert.ok(
      (await row.innerText()).includes("所持 8"),
      "購入後の所持数が更新されない"
    )
    await page
      .getByRole("button", { name: "お金が足りない", exact: true })
      .click()
    await page.evaluate(async () => window.__devStudio!.advance(7500))
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      after,
      "所持金不足で保存が変わった"
    )
    await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      const issue = game.restore(game.save())
      if (issue) throw issue
    })
    await page.evaluate(async () => window.__devStudio!.advance(8500))
    assert.ok(
      (await row.innerText()).includes("所持 8"),
      "保存を復元した後の所持数が違う"
    )
    console.log(
      `${width}: 契約石の所持7→8・代金のみ消費・不足時の拒否・保存復元 OK`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
