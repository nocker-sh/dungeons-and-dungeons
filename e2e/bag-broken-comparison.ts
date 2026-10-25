import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
import goods from "../src/lib/content/data/goods.json"
import shops from "../src/lib/content/data/shops.json"
const shop = shops.find((shop) =>
  shop.goods.some(
    (id) => goods.find((good) => good.id === id)?.kind === "armor"
  )
)!
const good = shop.goods.find(
  (id) => goods.find((good) => good.id === id)?.kind === "armor"
)!
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 900 }, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "bag",
            duration: 15000,
            width,
            height: 900,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const fixture = await page.evaluate(
      async ({ shop, good }) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const game = runtime.game!
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            gold: 100000,
            phase: { type: "town" },
          },
        })
        if (issue) throw issue
        if (!Array.isArray(game.send({ type: "buy", shop, good })))
          throw new Error("防具を買えない")
        const armor = game.queries
          .gear(game.state)
          .find((entry) => entry.id === good && !entry.ownerId)!
        const before = game.save()
        const broken = game.restore({
          ...before,
          snapshot: {
            ...before.snapshot,
            gear: before.snapshot.gear.map((entry) =>
              entry.id === armor.gear
                ? { ...entry, wear: armor.armor!.maxDurability }
                : entry
            ),
          },
        })
        if (broken) throw broken
        await runtime.advance(3500)
        return { name: armor.name, save: JSON.stringify(game.save()) }
      },
      { shop: shop.id, good }
    )
    await page.getByRole("button", { name: "装備", exact: true }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4000)
    )
    await page
      .getByRole("button", { name: fixture.name, exact: true })
      .last()
      .click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4500)
    )
    await page.getByRole("button", { name: "仲間に装備", exact: true }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(5000)
    )
    const details = page.getByRole("region", {
      name: "装備後の比較",
      exact: true,
    })
    if (
      !(await details.innerText()).includes(
        "着替え後は耐久切れ：ダメージを防げません。修理が必要です。"
      )
    )
      throw new Error("比較で耐久切れを伝えない")
    await page.screenshot({
      path: `/tmp/dnd-bag-broken-comparison-${width}.png`,
    })
    await page.keyboard.press("Escape")
    const after = await page.evaluate(() =>
      JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
    )
    if (after !== fixture.save) throw new Error("比較取消で保存が変わる")
    console.log(`${width}: 耐久切れの装備前警告・取消の保存保持`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
