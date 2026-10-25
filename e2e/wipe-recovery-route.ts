import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280])
    for (const kind of ["wipe"] as const) {
      const page = await openPage(browser, { width, height: 760 }, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: `result-${kind}`,
              duration: 50000,
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
      let time = 7500
      const click = async (name: string) => {
        await page.getByRole("button", { name, exact: true }).click()
        time += 4000
        await page.evaluate(
          (value) => (window.__devStudio as StudioRuntime).advance(value),
          time
        )
      }
      // 宿はギルドの中
      await click("冒険者ギルド")
      await click("宿")
      await click("屋根裏")
      await page
        .getByRole("button", { name: "泊まる", exact: true })
        .waitFor({ state: "visible" })
      await page.screenshot({
        path: `/tmp/dnd-wipe-recovery-route-${width}-inn.png`,
      })
      await click("‹ 戻る")
      await click("‹ 戻る")
      await click("‹ 戻る")
      await click("商店街")
      await click("鍛冶屋")
      await page
        .getByRole("button", { name: "修理", exact: true })
        .waitFor({ state: "visible" })
      await page.screenshot({
        path: `/tmp/dnd-wipe-recovery-route-${width}-smithy.png`,
      })
      await click("修理")
      const repairs = await page.evaluate(() => {
        const game = (window.__devStudio as StudioRuntime).game!
        return game.queries.repairs(game.state)
      })
      if (!repairs || !repairs.rows.length) throw new Error("修理対象がない")
      const rows = page.locator(".listview .slot-item.row")
      if (
        (await rows.count()) !==
        repairs.rows.length + (repairs.all.wear > 0 ? 1 : 0)
      )
        throw new Error("修理一覧と対象が一致しない")
      await page.screenshot({
        path: `/tmp/dnd-wipe-recovery-route-${width}-repairs.png`,
      })
      const final = await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      )
      for (const key of ["gold", "bag", "gear", "members"] as const)
        if (
          JSON.stringify(final.snapshot[key]) !==
          JSON.stringify(before.snapshot[key])
        )
          throw new Error(`${key}が施設への移動で変わる`)
      console.log(
        `${width}: 全滅結果から屋根裏・鍛冶屋へ実操作で到達、資産保持`
      )
      await page.close()
    }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
