import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import smithy from "../src/lib/content/data/smithy.json"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    for (const mode of ["upgrade", "craft"] as const)
      for (const condition of ["gold", "materials", "both"] as const) {
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
        const cost = mode === "upgrade" ? smithy.upgrades[0] : smithy.recipes[0]
        if (!cost.gold || !cost.materials.length)
          throw new Error("不足検証の費用がない")
        const saved = await page.evaluate(
          async ({ cost, condition, mode }) => {
            const runtime = window.__devStudio as StudioRuntime
            await runtime.advance(2500)
            const game = runtime.game!
            const saved = game.save()
            const issue = game.restore({
              ...saved,
              snapshot: {
                ...saved.snapshot,
                gold: condition === "materials" ? 100000 : 0,
                bag:
                  condition === "gold"
                    ? cost.materials.map((entry) => ({
                        good: entry.good,
                        count: entry.count,
                      }))
                    : [],
              },
            })
            if (issue) throw issue
            await runtime.advance(3500)
            const view = game.queries.smithy(game.state)!
            const entry =
              mode === "upgrade" ? view.upgrades[0] : view.recipes[0]
            if (
              entry.ready ||
              entry.missingGold !== (condition !== "materials") ||
              entry.missingMaterials !== (condition !== "gold")
            )
              throw new Error("不足Queryが違う")
            return JSON.stringify(game.save())
          },
          { cost, condition, mode }
        )
        await page
          .getByRole("button", {
            name: mode === "upgrade" ? "強化" : "生産",
            exact: true,
          })
          .click()
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).advance(5000)
        )
        await page.locator(".listview .slot-item.row").first().click()
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).advance(6500)
        )
        const message =
          condition === "gold"
            ? "お金が足りない"
            : condition === "materials"
              ? "素材が足りない"
              : "素材とお金が足りない"
        const action = page.getByRole("button", { name: message, exact: true })
        await action.waitFor({ state: "visible" })
        await action.click()
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).advance(7500)
        )
        await page.screenshot({
          path: `/tmp/dnd-smithy-shortages-${viewport.name}-${mode}-${condition}.png`,
        })
        if (
          (await page.evaluate(() =>
            JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
          )) !== saved
        )
          throw new Error("不足時の操作拒否で保存が変わる")
        console.log(
          `${viewport.name}/${mode}/${condition}: 不足Query・案内・実拒否・保存保持`
        )
        await page.close()
      }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
