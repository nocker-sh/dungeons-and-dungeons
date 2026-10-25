import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280])
    for (const kind of ["wipe", "ending"] as const) {
      const page = await openPage(browser, { width, height: 760 }, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: `result-${kind}`,
              duration: 15000,
              width,
              height: 760,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      const before = await page.evaluate(async () => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(4500)
        return runtime.game!.save()
      })
      const dialog = page.getByRole("dialog", {
        name: kind === "wipe" ? "全滅の結果" : "踏破の結果",
        exact: true,
      })
      await dialog.waitFor({ state: "visible" })
      for (const name of ["ダンジョン", "冒険者ギルド", "商店街"])
        if (await page.getByRole("button", { name, exact: true }).count())
          throw new Error(`${name}が結果の背後に残る`)
      await page.screenshot({
        path: `/tmp/dnd-result-town-menu-${width}-${kind}.png`,
      })
      await dialog
        .getByRole("button", {
          name: kind === "wipe" ? "街へ" : "まだ潜る",
          exact: true,
        })
        .click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(7500)
      )
      await page
        .getByRole("button", { name: "ダンジョン", exact: true })
        .waitFor({ state: "visible" })
      const after = await page.evaluate(() => {
        const game = (window.__devStudio as StudioRuntime).game!
        return { result: game.queries.result(game.state), save: game.save() }
      })
      if (after.result) throw new Error("結果が残る")
      for (const key of ["gold", "bag", "gear", "members"] as const)
        if (
          JSON.stringify(after.save.snapshot[key]) !==
          JSON.stringify(before.snapshot[key])
        )
          throw new Error(`${key}が変わる`)
      await page
        .getByRole("button", { name: "ダンジョン", exact: true })
        .click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(10000)
      )
      await page
        .getByRole("button", { name: "カチコミ", exact: true })
        .waitFor({ state: "visible" })
      console.log(
        `${width}/${kind}: 結果中の街メニューなし・閉じて復帰・資産と仲間保持`
      )
      await page.close()
    }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
