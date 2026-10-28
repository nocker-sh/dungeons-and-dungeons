import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import goods from "@/content/data/goods.json"

const potion = goods.find((entry) => entry.slug === "potion")!
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    for (const scene of ["route-loot", "route-treasure", "route-trap"]) {
      const page = await openPage(browser, { width, height: 844 }, errors)
      await page.routeWebSocket("**/*", () => {})
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({ scene, width, height: 844, duration: 30000 })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      let time = 3500
      const advance = async () => {
        time += 1200
        await page.evaluate(
          async (time) => window.__devStudio!.advance(time),
          time
        )
      }
      await advance()
      const expected = await page.evaluate((potion) => {
        const game = (window.__devStudio as StudioRuntime).game!
        const saved = game.save()
        if (
          saved.snapshot.phase.type !== "expedition" ||
          !saved.snapshot.phase.expedition.pending
        )
          throw new Error("結果表示中ではない")
        const target = saved.snapshot.party[1]
        const count =
          saved.snapshot.bag
            .filter((entry) => entry.good === potion)
            .reduce((sum, entry) => sum + entry.count, 0) + 2
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            bag: [
              ...saved.snapshot.bag.filter((entry) => entry.good !== potion),
              { good: potion, count },
            ],
            provisions: [{ good: potion, count: 2 }],
            members: saved.snapshot.members.map((member) => {
              const maxHp = game.queries.member(game.state, member.id)!.maxHp
              return {
                ...member,
                hp: member.id === target ? maxHp - 10 : maxHp,
              }
            }),
          },
        })
        if (issue) throw issue
        const item = game.queries
          .items(game.state)
          .find((entry) => entry.id === potion)!
        return {
          save: game.save(),
          target,
          targets: item.targets,
          after: item.healing!.find((entry) => entry.id === target)!.after,
        }
      }, potion.id)
      assert.deepEqual(expected.targets, [expected.target])
      await advance()
      await page.getByRole("button", { name: "バッグ", exact: true }).click()
      await advance()
      const choose = async () => {
        await page
          .getByRole("button", { name: potion.name, exact: true })
          .click()
        await advance()
        await page.getByRole("button", { name: "使う", exact: true }).click()
        await advance()
        assert.equal(await page.locator(".target-dim").count(), 1)
      }
      await choose()
      await page.keyboard.press("Escape")
      await advance()
      assert.deepEqual(
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).game!.save()
        ),
        expected.save
      )
      await choose()
      await page
        .locator(
          `.card .hit[aria-describedby="target-detail-${expected.target}"]`
        )
        .click()
      await advance()
      const after = await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      )
      assert.deepEqual(after, {
        ...expected.save,
        snapshot: {
          ...expected.save.snapshot,
          bag: expected.save.snapshot.bag.map((entry) =>
            entry.good === potion.id
              ? { ...entry, count: entry.count - 1 }
              : entry
          ),
          provisions: [{ good: potion.id, count: 1 }],
          members: expected.save.snapshot.members.map((member) =>
            member.id === expected.target
              ? { ...member, hp: expected.after }
              : member
          ),
        },
      })
      assert.equal(
        await page.getByRole("button", { name: "使う", exact: true }).count(),
        0,
        "満タンならもう使えない"
      )
      await page.keyboard.press("Escape")
      await advance()
      assert.equal(await page.locator(".listview.bag").count(), 0)
      assert.deepEqual(
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).game!.save()
        ),
        after
      )
      await page.screenshot({
        path: `/tmp/dnd-bag-pending-${width}-${scene}.png`,
      })
      console.log(
        `${width}/${scene}: 結果表示中の回復、対象取消・満タン制限、1個の消費と戦利品・結果の保持 OK`
      )
      await page.close()
    }
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
