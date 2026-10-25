import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import goods from "../src/lib/content/data/goods.json"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
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
            scene: "smithy-repair",
            duration: 15000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const saved = await page.evaluate(
      async (weaponIds) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const game = runtime.game!
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            gear: saved.snapshot.gear.filter(
              (entry) => !weaponIds.includes(entry.good)
            ),
          },
        })
        if (issue) throw issue
        await runtime.advance(3500)
        if (game.queries.smithy(game.state)!.inscriptions.length)
          throw new Error("武器なしの条件が違う")
        return JSON.stringify(game.save())
      },
      goods.filter((entry) => entry.kind === "weapon").map((entry) => entry.id)
    )
    await page.getByRole("button", { name: /ワザの付け替え/ }).click()
    const dialog = page.getByRole("dialog", { name: "ワザの付け替え" })
    const reason = dialog.locator("[data-inscription-empty]")
    if (!(await reason.innerText()).includes("武器を鑑定するか、武器屋で購入"))
      throw new Error("武器入手の案内がない")
    const bounds = await reason.boundingBox()
    if (
      !bounds ||
      bounds.x < 0 ||
      bounds.x + bounds.width > viewport.width ||
      bounds.y < 0 ||
      bounds.y + bounds.height > viewport.height
    )
      throw new Error("案内が画面外")
    if ((await dialog.getByRole("button").count()) !== 1)
      throw new Error("空の変更操作がある")
    const close = dialog.getByRole("button", { name: "閉じる", exact: true })
    if (
      !(await close.evaluate((element) => element === document.activeElement))
    )
      throw new Error("閉じるへフォーカスがない")
    await page.keyboard.press("Tab")
    if (
      !(await close.evaluate((element) => element === document.activeElement))
    )
      throw new Error("Tabが画面外へ出る")
    await page.screenshot({
      path: `/tmp/dnd-inscription-empty-${viewport.name}.png`,
    })
    await page.keyboard.press("Escape")
    if (await dialog.count()) throw new Error("空の画面が閉じない")
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== saved
    )
      throw new Error("案内で保存が変わる")
    console.log(`${viewport.name}: 空の案内・Tab・閉じる・保存保持`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
