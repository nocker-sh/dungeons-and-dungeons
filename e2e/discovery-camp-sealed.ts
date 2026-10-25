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
    for (const encounter of [
      {
        station: "l5",
        title: "見捨てられた野営地",
        artwork: "discovery-camp-fisheye-comic-v3",
        choice: "salvage",
        reward: "619ae895-2e95-4f01-ba6b-b78835debae7",
        count: 2,
      },
      {
        station: "l10",
        title: "封じられた宝箱",
        artwork: "discovery-sealed-chest-fisheye-comic-v4",
        choice: "tools",
        reward: "49c06f75-74e8-4a31-a9bb-d6b09e96d001",
        count: 1,
      },
    ]) {
      const page = await openPage(browser, viewport, errors)
      page.setDefaultTimeout(15000)
      console.log(`start: ${viewport.name} ${encounter.title}`)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "route-discovery",
              width: viewport.width,
              height: viewport.height,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      // Diagnostic setup only: use validated saves and actual event content, without altering rules.
      await page.evaluate(async (station) => {
        const runtime = window.__devStudio as StudioRuntime
        const game = runtime.game!
        const saved = game.save()
        if (saved.snapshot.phase.type !== "expedition")
          throw new Error("探索ではない")
        const problem = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            phase: {
              type: "expedition",
              expedition: {
                ...saved.snapshot.phase.expedition,
                at: station,
                visited: ["s", station],
                pending: { kind: "discovery" },
              },
            },
          },
        })
        if (problem) throw new Error(String(problem))
        await runtime.advance(2500)
      }, encounter.station)
      const dialog = page.getByRole("dialog", {
        name: encounter.title,
        exact: true,
      })
      await dialog.waitFor()
      const picture = dialog.locator(
        `img[src="/art/scenes/${encounter.artwork}.webp"]`
      )
      await picture.waitFor()
      if (
        !(await picture.evaluate(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth === 1536
        ))
      )
        throw new Error("画像を読み込めない")
      const bounds = await picture.boundingBox()
      if (
        !bounds ||
        bounds.width < 50 ||
        bounds.x < 0 ||
        bounds.x + bounds.width > viewport.width
      )
        throw new Error("画像が画面からはみ出す")
      const before = await page.evaluate((id) => {
        const game = (window.__devStudio as StudioRuntime).game!
        const choice = game.queries
          .route(game.state)!
          .discovery!.choices.find((choice) => choice.id === id)!
        return {
          gold: game.state.gold,
          cost: choice.cost ?? 0,
          label: choice.label,
        }
      }, encounter.choice)
      await page.screenshot({
        path: `/tmp/dnd-${encounter.artwork}-${viewport.name}.png`,
      })
      await dialog.getByRole("button").filter({ hasText: before.label }).click()
      await page.evaluate(async () => {
        await window.__devStudio!.advance(4500)
      })
      const after = await page.evaluate(() => {
        const game = (window.__devStudio as StudioRuntime).game!
        if (game.state.phase.type !== "expedition")
          throw new Error("探索ではない")
        return {
          gold: game.state.gold,
          pending: game.state.phase.expedition.pending,
        }
      })
      if (
        after.gold !== before.gold - before.cost ||
        after.pending?.kind !== "treasure"
      )
        throw new Error("取引の精算が一致しない")
      if (
        after.pending.goods.find((entry) => entry.good === encounter.reward)
          ?.count !== encounter.count
      )
        throw new Error("実際の回収数が一致しない")
      if (await dialog.count()) throw new Error("選択が終わらない")
      console.log(
        `${viewport.name}: ${encounter.title}の画像・${before.cost}G精算・報酬${encounter.count}個を確認`
      )
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
