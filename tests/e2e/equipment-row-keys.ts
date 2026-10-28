import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { tap } from "@/tests/e2e/tap"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import goods from "@/content/data/goods.json"

const junkId = goods.find((good) => good.slug === "junk")!.id
const browser = await launch()
try {
  for (const width of [320, 390, 1280]) {
    for (const id of [
      "auto-equip",
      "appraise-all",
      "gear:auto-equip",
      junkId,
    ]) {
      const errors: string[] = []
      const page = await openPage(browser, { width, height: 844 }, errors)
      await page.routeWebSocket("**/*", () => {})
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "shop-armory-junk",
              width,
              height: 844,
              duration: 60000,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      let time = 3500
      const advance = async (ms = 1000) => {
        time += ms
        await page.evaluate((time) => window.__devStudio!.advance(time), time)
      }
      await advance()
      const fixture = await page.evaluate((id) => {
        const game = (window.__devStudio as StudioRuntime).game!
        const saved = game.save()
        const good = game.queries.good("43e8c836-8d6c-47f5-bd33-e8a1e6aabc67")!
        const weapon = {
          id,
          good: good.id,
          owner: null,
          plus: 1,
          progress: 0,
          wear: 0,
          unidentified: true,
          weapon: {
            rarity: "N" as const,
            extraPower: 0,
            skills: [...good.skills!],
          },
        }
        const alternative = {
          ...structuredClone(weapon),
          id: "other-weapon",
          plus: 3,
          unidentified: false,
        }
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            members: saved.snapshot.members.map((member) => ({
              ...member,
              stats: { ...member.stats, str: 30 },
            })),
            gear: [...saved.snapshot.gear, weapon, alternative],
            bag: [{ good: game.queries.junk(game.state).id, count: 2 }],
          },
        })
        if (issue) throw issue
        return {
          before: game.save(),
          name: game.queries
            .gear(game.state)
            .find((entry) => entry.gear === id)!.name,
        }
      }, id)
      await advance()
      const save = () =>
        page.evaluate(() => (window.__devStudio as StudioRuntime).game!.save())
      const press = async (name: string, ms = 1000) => {
        const button = page.getByRole("button", { name, exact: true })
        assert.equal(await button.count(), 1, `${id}: ${name} がない`)
        await tap(page, button)
        await advance(ms)
      }
      await press("鑑定")
      await tap(page, page.locator(".row", { hasText: fixture.name }))
      await advance()
      await press("鑑定する", 3500)
      const identified = await save()
      assert.deepEqual(
        identified,
        {
          ...fixture.before,
          snapshot: {
            ...fixture.before.snapshot,
            gear: fixture.before.snapshot.gear.map((entry) =>
              entry.id === id ? { ...entry, unidentified: false } : entry
            ),
          },
        },
        "選んだ武器以外の資産や装備が変わった"
      )
      const expected = await page.evaluate((id) => {
        const game = (window.__devStudio as StudioRuntime).game!
        return {
          entry: game.queries
            .gear(game.state)
            .find((entry) => entry.gear === id)!,
          best: game.queries.upgrades(game.state, id)[0]!,
        }
      }, id)
      assert.ok(expected.best)
      await press("押して一覧へ")
      const details = page.getByRole("region", {
        name: "選んだ品の詳細",
        exact: true,
      })
      assert.ok(
        (await details.innerText()).includes(expected.entry.name),
        "鑑定した武器が選択されていない"
      )
      await press(`${expected.best.name}に持たせる`)
      const equipped = await save()
      assert.deepEqual(
        equipped.snapshot.gear,
        identified.snapshot.gear.map((entry) =>
          entry.id === id ? { ...entry, owner: expected.best.member } : entry
        ),
        "個別の装備操作がおまかせ装備になった"
      )
      assert.deepEqual(equipped.snapshot.bag, identified.snapshot.bag)
      assert.equal(equipped.snapshot.gold, identified.snapshot.gold)
      await page.keyboard.press("Escape")
      await advance()
      await tap(
        page,
        page.locator(".formation").getByRole("button", {
          name: new RegExp(`^${expected.best.name} HP`),
        })
      )
      await advance()
      await press("装備")
      await tap(page, page.locator(".row", { hasText: expected.entry.name }))
      await advance()
      await press("外す")
      assert.deepEqual((await save()).snapshot.gear, identified.snapshot.gear)
      await press("持ち物")
      await tap(page, page.locator(".row", { hasText: expected.entry.name }))
      await advance()
      await press("着ける")
      assert.deepEqual((await save()).snapshot.gear, equipped.snapshot.gear)
      const restored = await page.evaluate(() => {
        const game = (window.__devStudio as StudioRuntime).game!
        const saved = game.save()
        const issue = game.restore(saved)
        if (issue) throw issue
        return game.save()
      })
      assert.deepEqual(restored, equipped)
      assert.deepEqual(errors, [])
      console.log(
        `${width}/${id}: 鑑定・個別装備・取り外し・再装備・保存復元 OK`
      )
      await page.close()
    }
  }
} finally {
  await browser.close()
}
