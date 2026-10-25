import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import goods from "../src/lib/content/data/goods.json"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"

const browser = await launch()
const errors: string[] = []
const longest = [...goods]
  .filter((good) => good.kind === "weapon")
  .sort((left, right) => right.name.length - left.name.length)
  .slice(0, 2)
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
            scene: "route-loot-rare",
            duration: 15000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const saved = await page.evaluate(async (items) => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(3500)
      const game = runtime.game!
      const saved = game.save()
      const phase = saved.snapshot.phase
      if (
        phase.type !== "expedition" ||
        phase.expedition.pending?.kind !== "loot"
      )
        throw new Error("戦利品でない")
      const issue = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          gear: [
            ...saved.snapshot.gear,
            ...items.map((item, index) => ({
              ...saved.snapshot.gear.find(
                (entry) => entry.id === "preview-drop"
              )!,
              id: `long-name-${index}`,
              good: item.id,
              weapon: {
                rarity: "SR" as const,
                extraPower: 0,
                skills: item.skills ?? [],
              },
            })),
          ],
          phase: {
            ...phase,
            expedition: {
              ...phase.expedition,
              pending: {
                ...phase.expedition.pending,
                weapons: items.map((_, index) => `long-name-${index}`),
                stones: 0,
                goods: [],
              },
            },
          },
        },
      })
      if (issue) throw issue
      await runtime.advance(5000)
      return JSON.stringify(game.save())
    }, longest)
    for (const item of longest) {
      const button = page.getByRole("button", {
        name: `SR ${item.name} ×1`,
        exact: true,
      })
      const label = button.locator("span").filter({ hasText: item.name }).last()
      const bounds = await label.boundingBox()
      if (
        !bounds ||
        bounds.x < 0 ||
        bounds.x + bounds.width > viewport.width ||
        bounds.height > 100 ||
        bounds.y + bounds.height > viewport.height
      )
        throw new Error(
          `${viewport.name}：${item.name}が画面外 ${JSON.stringify(bounds)}`
        )
      if ((await label.innerText()) !== `SR ${item.name}`)
        throw new Error("品名が欠けた")
    }
    await page.screenshot({
      path: `/tmp/dnd-loot-long-names-${viewport.name}.png`,
    })
    const after = await page.evaluate(() =>
      JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
    )
    if (saved !== after) throw new Error("表示で保存が変化")
    console.log(`${viewport.name}: 長い品名2件が省略なしで画面内に収まる`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
