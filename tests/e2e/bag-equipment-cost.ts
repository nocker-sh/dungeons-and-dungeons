import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import goods from "@/content/data/goods.json"
import shops from "@/content/data/shops.json"

const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(
      BASE_URL +
        frameUrl(parseStudioConfig({ scene: "bag", width, duration: 14000 }))
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const saved = await page.evaluate(
      async (candidate) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(3500)
        const game = runtime.game!
        const initial = game.save()
        const issue = game.restore({
          ...initial,
          snapshot: { ...initial.snapshot, gold: 10000, bag: [] },
        })
        if (issue) throw new Error(String(issue.cause))
        const bought = game.send({ type: "buy", ...candidate })
        if (!Array.isArray(bought)) throw bought
        const purchased = game.state.gear.find(
          (entry) => !initial.snapshot.gear.some((old) => old.id === entry.id)
        )!
        const next = game.save()
        const original = game.queries.equipOptions.bind(game.queries)
        const counts = new WeakMap<object, Map<string, number>>()
        const measured = { calls: 0, maxPerMember: 0 }
        Object.assign(window, { bagEquipmentMeasure: measured })
        game.queries.equipOptions = (state, member) => {
          const perMember = counts.get(state) ?? new Map<string, number>()
          counts.set(state, perMember)
          const count = (perMember.get(member) ?? 0) + 1
          perMember.set(member, count)
          measured.calls++
          measured.maxPerMember = Math.max(measured.maxPerMember, count)
          return original(state, member)
        }
        const invalid = game.restore({
          ...next,
          snapshot: {
            ...next.snapshot,
            gear: [
              ...next.snapshot.gear,
              ...Array.from({ length: 150 }, (_, index) => ({
                ...structuredClone(purchased),
                id: `scroll-gear-${index}`,
              })),
            ],
          },
        })
        if (invalid) throw new Error(String(invalid.cause))
        return game.save()
      },
      {
        shop: shops.find((shop) => shop.slug === "armory")!.id,
        good: goods.find((good) => good.slug === "dagger")!.id,
      }
    )
    await page.evaluate(async () => window.__devStudio!.advance(5000))
    await page.getByRole("button", { name: "装備", exact: true }).click()
    await page.evaluate(async () => window.__devStudio!.advance(5500))
    const measured = await page.evaluate(
      () =>
        (
          window as unknown as {
            bagEquipmentMeasure: { calls: number; maxPerMember: number }
          }
        ).bagEquipmentMeasure
    )
    console.log(JSON.stringify({ width, ...measured }))
    assert.equal(
      await page.locator(".listview .row").count(),
      saved.snapshot.gear.length
    )
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      saved
    )
    assert.ok(
      measured.maxPerMember <= 1,
      "同じ状態の装備候補を仲間ごとに何度も作り直している"
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
