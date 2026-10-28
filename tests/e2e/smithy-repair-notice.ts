import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280])
    for (const mode of ["single", "all"] as const) {
      const page = await openPage(browser, { width, height: 900 }, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "smithy-repair",
              duration: 15000,
              width,
              height: 900,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      const fixture = await page.evaluate(async (mode) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const game = runtime.game!
        const save = game.save()
        const issue = game.restore({
          ...save,
          snapshot: { ...save.snapshot, gold: 100000 },
        })
        if (issue) throw issue
        await runtime.advance(3500)
        const view = game.queries.repairs(game.state)
        const row = view.rows.find((entry) => !entry.full)!
        if (!row || !view.all.ready) throw new Error("修理対象がない")
        return {
          before: JSON.stringify(game.save()),
          name: row.name,
          cost: mode === "all" ? view.all.gold : row.gold,
          gear: row.gear,
          rows: view.rows,
        }
      }, mode)
      await page.getByRole("button", { name: "修理", exact: true }).click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(5000)
      )
      const rows = page.locator(".listview .slot-item.row")
      await rows
        .nth(
          mode === "all"
            ? 0
            : fixture.rows.findIndex((row) => row.gear === fixture.gear) + 1
        )
        .click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(6500)
      )
      await page
        .getByRole("button", {
          name: `${fixture.cost}G で${mode === "all" ? "全部直す" : "直す"}`,
          exact: true,
        })
        .click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(7500)
      )
      const expected =
        mode === "all"
          ? "着けている防具を全部修理しました。"
          : `${fixture.name}を修理しました。`
      if ((await page.getByRole("status").textContent()) !== expected)
        throw new Error("修理通知が違う")
      const after = await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )
      const beforeSave = JSON.parse(fixture.before)
      const targets =
        mode === "all" ? fixture.rows.map((row) => row.gear) : [fixture.gear]
      const expectedGear = beforeSave.snapshot.gear.map(
        (gear: { id: string; wear: number }) =>
          targets.includes(gear.id) ? { ...gear, wear: 0 } : gear
      )
      const expectedSave = {
        ...beforeSave,
        snapshot: {
          ...beforeSave.snapshot,
          gold: 100000 - fixture.cost,
          gear: expectedGear,
        },
      }
      if (JSON.stringify(expectedSave) !== after)
        throw new Error("修理以外の保存が変わる")
      await page.screenshot({
        path: `/tmp/dnd-repair-notice-${width}-${mode}.png`,
      })
      console.log(
        `${width}/${mode}: 修理通知・耐久回復・費用のみ消費・他保存保持`
      )
      await page.close()
    }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
