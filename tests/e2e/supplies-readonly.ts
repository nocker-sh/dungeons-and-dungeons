import layers from "@/content/data/layers.json"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import goods from "@/content/data/goods.json"

const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    const page = await openPage(browser, viewport, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "bag",
            duration: 10000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const expected = await page.evaluate(
      async ({ goods, layer }) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const game = runtime.game!
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            bag: goods.map((good) => ({ good: good.id, count: 3 })),
            provisions: goods.map((good) => ({ good: good.id, count: 1 })),
            phase: {
              type: "expedition",
              expedition: {
                layer,
                at: "s",
                visited: ["s"],
                events: [],
                pending: null,
                loot: { gold: 0, goods: [] },
                cleared: false,
              },
            },
          },
        })
        if (issue) throw issue
        await runtime.advance(3000)
        const supplies = game.queries.supplies(game.state)
        if (
          supplies.editable ||
          supplies.count !== 4 ||
          supplies.items.some((item) => item.carried !== 1 || item.stored !== 2)
        )
          throw new Error("探索中の持ち出し前提が違う")
        const items = game.queries.items(game.state)
        if (items.some((item) => item.count !== 1))
          throw new Error("倉庫分も探索で使える")
        return JSON.stringify(game.save())
      },
      {
        goods: goods.filter((good) =>
          ["potion", "ether", "antidote", "revival-incense"].includes(good.slug)
        ),
        layer: layers[0].id,
      }
    )
    await page
      .getByRole("button", { name: "手持ちと倉庫を見る", exact: true })
      .click()
    const dialog = page.getByRole("dialog", {
      name: "倉庫と手持ち",
      exact: true,
    })
    await dialog.waitFor()
    const status = dialog.getByRole("status")
    if (
      !(await status.innerText()).includes(
        "空き枠：4個。持ち替えは街でできます。"
      )
    )
      throw new Error("その場で持ち出せる案内が残る")
    if ((await dialog.getByRole("button").count()) !== 1)
      throw new Error("探索中の持ち替え操作がある")
    if (!(await dialog.innerText()).includes("倉庫の品物は街で持ち出せます。"))
      throw new Error("倉庫の扱いが説明されない")
    await page.screenshot({
      path: `/tmp/dnd-supplies-readonly-${viewport.name}.png`,
    })
    await dialog
      .getByRole("button", { name: "持ち出しを閉じる", exact: true })
      .click()
    await dialog.waitFor({ state: "hidden" })
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== expected
    )
      throw new Error("閲覧で保存状態が変化")
    console.log(
      `${viewport.name}: 探索中は街での持ち替えを案内、倉庫を使わず状態保持`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
