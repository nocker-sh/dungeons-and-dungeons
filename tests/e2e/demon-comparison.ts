import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import { contentId } from "@/lib/wiz/testing/content-id"
import { characterGroups } from "@/concept/characters"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const ids = {
  hero: contentId("hero"),
  lox: contentId("lox"),
  nui: contentId("nui"),
}
const name = characterGroups
  .flatMap((group) => group.characters)
  .find((character) => character.id === ids.nui)!.name
const errors: string[] = []
const browser = await launch()
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 900 }, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "secret-demons",
            width,
            height: 900,
            duration: 20000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const expected = await page.evaluate(async (ids) => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(9000)
      const game = runtime.game!
      let saved = game.save()
      let error = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          contract: ids.lox,
          demons: [
            { id: ids.lox, lv: 10, exp: 0 },
            { id: ids.nui, lv: 1, exp: 0 },
          ],
        },
      })
      if (error) throw error
      saved = game.save()
      const hp = game.queries.member(game.state, ids.hero)!.maxHp
      error = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          members: saved.snapshot.members.map((member) =>
            member.id === ids.hero ? { ...member, hp } : member
          ),
        },
      })
      if (error) throw error
      await runtime.advance(9500)
      return {
        save: JSON.stringify(game.save()),
        comparison: game.queries
          .demons(game.state)
          .find((demon) => demon.id === ids.nui)!.comparison!,
      }
    }, ids)
    await page
      .getByRole("button", { name: "合体する", exact: true })
      .first()
      .click()
    const row = page.getByRole("button", { name, exact: true })
    assert.match((await row.textContent()) ?? "", /HPが下がる/)
    await row.click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(11000)
    )
    const comparison = page.locator("[data-demon-comparison]")
    const { before, after } = expected.comparison
    assert.ok(after.hp < before.hp)
    assert.match(
      (await comparison.textContent()) ?? "",
      new RegExp(`攻撃力 ${before.attack} → ${after.attack}`)
    )
    assert.ok(
      (await comparison.textContent())!.includes(
        `HP ${before.hp}/${before.maxHp} → ${after.hp}/${after.maxHp}`
      )
    )
    await comparison.evaluate((element) =>
      element.scrollIntoView({ block: "center" })
    )
    const visible = await comparison.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const region = element.closest('[role="region"]')!.getBoundingClientRect()
      return (
        box.left >= 0 &&
        box.right <= innerWidth &&
        box.top >= region.top &&
        box.bottom <= region.bottom
      )
    })
    assert.ok(visible, "HPと攻撃力の比較が詳細の表示範囲外")
    assert.equal(
      await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      ),
      expected.save
    )
    if (width === 390)
      await page.screenshot({ path: "/tmp/dnd-demon-comparison.png" })
    await page
      .getByRole("button", { name: "合体する", exact: true })
      .last()
      .click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(12000)
    )
    const actual = await page.evaluate((ids) => {
      const game = (window.__devStudio as StudioRuntime).game!
      const member = game.queries.member(game.state, ids.hero)!
      const saved = game.save()
      if (game.restore(saved)) throw new Error("保存を復元できない")
      return {
        contract: game.state.contract,
        hp: member.hp,
        maxHp: member.maxHp,
        attack: member.weapon!.attack,
      }
    }, ids)
    assert.deepEqual(actual, { contract: ids.nui, ...after })
    console.log(
      `${width}: 合体前後のHP・攻撃力比較、HP低下表示、閲覧で保存保持、実際の合体・復元と一致`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
