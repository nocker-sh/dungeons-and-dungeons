import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    for (const layer of [3, 4]) {
      const page = await openPage(browser, viewport, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: `route-layer${layer}`,
              duration: 15000,
              width: viewport.width,
              height: viewport.height,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      const expected = await page.evaluate(async () => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(3500)
        const game = runtime.game!
        const saved = game.save()
        if (saved.snapshot.phase.type !== "expedition")
          throw new Error("探索の場面ではない")
        const problem = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            phase: {
              ...saved.snapshot.phase,
              expedition: {
                ...saved.snapshot.phase.expedition,
                at: "n4",
                visited: ["s", "n4"],
                pending: null,
              },
            },
          },
        })
        if (problem) throw problem
        await runtime.advance(4500)
        const path = game.queries
          .route(game.state)!
          .paths.find((entry) => entry.id === "u5")!
        return {
          details: path.details.filter((line) => line.startsWith("耐性（")),
          save: JSON.stringify(game.save()),
        }
      })
      if (!expected.details.length) throw new Error("固定敵に耐性の案内がない")
      await page.locator('[data-route-choice="u5"]').click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(5500)
      )
      const detail = page.getByRole("region", { name: "選んだ道の見通し" })
      for (const line of expected.details)
        if (!(await detail.innerText()).includes(line))
          throw new Error("道の比較に耐性がない")
      await detail.evaluate((element) => {
        element.scrollTop = 0
      })
      const bounds = await detail.boundingBox()
      if (
        !bounds ||
        bounds.x < 0 ||
        bounds.x + bounds.width > viewport.width + 1
      )
        throw new Error("見通しが画面外へ出る")
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== expected.save
      )
        throw new Error("分岐の閲覧で保存が変わる")
      await page.screenshot({
        path: `/tmp/dnd-branch-resistances-${viewport.name}-${layer}.png`,
      })
      console.log(`${viewport.name}/${layer}層: 固定敵の耐性・表示・保存保持`)
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
