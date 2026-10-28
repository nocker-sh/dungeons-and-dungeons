import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import settings from "@/content/data/settings.json"
import goods from "@/content/data/goods.json"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

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
            scene: "route",
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
      async (loot) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const game = runtime.game!
        const saved = game.save()
        if (saved.snapshot.phase.type !== "expedition")
          throw new Error("探索でない")
        const original = saved.snapshot.gear[0]
        if (!original) throw new Error("装備の前提がない")
        const midboss = game.queries
          .route(game.state)!
          .stations.find((station) => station.midboss)!
        const picked = ["carrying-picked-1", "carrying-picked-2"]
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            gold: saved.snapshot.gold + loot.gold,
            bag: [
              ...saved.snapshot.bag.filter(
                (stack) =>
                  !loot.goods.some((entry) => entry.good === stack.good)
              ),
              ...loot.goods.map((stack) => ({
                ...stack,
                count:
                  stack.count +
                  saved.snapshot.bag
                    .filter((entry) => entry.good === stack.good)
                    .reduce((sum, entry) => sum + entry.count, 0),
              })),
            ],
            gear: [
              ...saved.snapshot.gear,
              ...picked.map((id) => ({ ...original, id, owner: null })),
            ],
            phase: {
              ...saved.snapshot.phase,
              expedition: {
                ...saved.snapshot.phase.expedition,
                visited: [
                  ...saved.snapshot.phase.expedition.visited,
                  midboss.id,
                ],
                loot: { ...loot, weapons: picked },
              },
            },
          },
        })
        if (issue) throw issue
        await runtime.advance(3500)
        return {
          save: JSON.stringify(game.save()),
          bonus: game.queries.route(game.state)!.bonus,
          gold: game.queries.route(game.state)!.returnBalance,
        }
      },
      {
        gold: 99999,
        goods: [
          { good: settings.junk, count: 2 },
          { good: settings.rareJunk, count: 3 },
          { good: goods.find((good) => good.slug === "bone")!.id, count: 7 },
        ],
      }
    )
    const label = page.getByText(
      `帰還後の所持金 ${expected.gold}G（手当て +${expected.bonus}G）`,
      { exact: true }
    )
    if (!(expected.bonus > 0) || !(await label.isVisible()))
      throw new Error("手当てがない")
    const panel = page.getByRole("status")
    if (
      !(await panel.getAttribute("aria-label"))?.includes(
        `帰還後の所持金 ${expected.gold}G（手当て +${expected.bonus}G）`
      )
    )
      throw new Error("読み上げに帰還金額がない")
    const bounds = await label.boundingBox()
    if (!bounds || bounds.x < 0 || bounds.x + bounds.width > viewport.width)
      throw new Error(`帰還金額が画面外: ${JSON.stringify(bounds)}`)
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== expected.save
    )
      throw new Error("表示で状態が変化")
    await page.screenshot({
      path: `/tmp/dnd-return-bonus-${viewport.name}.png`,
    })
    console.log(`${viewport.name}: 帰還金額と手当て・収まり・保存保持を確認`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
