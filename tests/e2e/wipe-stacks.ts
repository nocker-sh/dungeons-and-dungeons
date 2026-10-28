import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import goods from "@/content/data/goods.json"

const junk = goods.find((entry) => entry.slug === "junk")!
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "battle",
            width,
            height: 844,
            duration: 15000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const saved = await page.evaluate(async (junk) => {
      const runtime = window.__devStudio as StudioRuntime
      const game = runtime.game!
      const before = game.save()
      if (before.snapshot.phase.type !== "battle")
        throw new Error("戦闘ではない")
      const phase = before.snapshot.phase
      const issue = game.restore({
        ...before,
        snapshot: {
          ...before.snapshot,
          members: before.snapshot.members.map((member) => ({
            ...member,
            hp: 1,
          })),
          bag: [{ good: junk, count: 7 }],
          provisions: [],
          phase: {
            ...phase,
            expedition: {
              ...phase.expedition,
              loot: {
                gold: 0,
                goods: Array.from({ length: 4 }, () => ({
                  good: junk,
                  count: 1,
                })),
              },
            },
          },
        },
      })
      if (issue) throw issue
      for (
        let step = 0;
        step < 100 && game.state.phase.type === "battle";
        step++
      ) {
        const view = game.queries.battle(game.state)!
        const result = game.send(
          view.current.kind === "foe"
            ? { type: "foe-turn" }
            : { type: "act", command: "guard" }
        )
        if (!Array.isArray(result)) throw result
      }
      if (game.state.phase.type !== "town" || !game.state.wipe)
        throw new Error("全滅していない")
      const saved = game.save()
      const restored = game.restore(saved)
      if (restored) throw restored
      await runtime.advance(6000)
      return saved
    }, junk.id)
    assert.deepEqual(saved.snapshot.bag, [{ good: junk.id, count: 5 }])
    assert.deepEqual(saved.snapshot.wipe!.goods, [{ good: junk.id, count: 2 }])
    assert.deepEqual(saved.snapshot.wipe!.kept, [{ good: junk.id, count: 2 }])
    const dialog = page.getByRole("dialog", { name: "全滅の結果", exact: true })
    for (const name of ["失った物", "持ち帰れた物"]) {
      const group = dialog.getByRole("group", { name, exact: true })
      assert.equal(
        await group.getByText(`${junk.name} ×2`, { exact: true }).count(),
        1
      )
      assert.equal(
        await group.getByText(`${junk.name} ×1`, { exact: true }).count(),
        0
      )
    }
    await page.screenshot({ path: `/tmp/dnd-wipe-stacks-${width}.png` })
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      saved
    )
    await dialog.getByRole("button", { name: "街へ", exact: true }).click()
    await page.evaluate(() => window.__devStudio!.advance(9000))
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      {
        ...saved,
        snapshot: { ...saved.snapshot, wipe: null },
      }
    )
    console.log(
      `${width}: 分割された戦利品の全滅精算、保存復元、損失2個・持ち帰り2個の表示、街へ戻る際の資産保持 OK`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
