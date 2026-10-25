import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 760 }, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "smithy-reforge",
            width,
            height: 760,
            duration: 20000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const before = await page.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(2500)
      const game = runtime.game!
      const entry = game.queries.reforges(game.state)[0]
      if (
        entry.plus !== 0 ||
        entry.progress !== 0 ||
        entry.materials.length < 2
      )
        throw new Error("鍛え直しの前提が違う")
      const weapon = game.queries.member(game.state, entry.member!)!.weapon!
      return {
        gold: game.state.gold,
        member: entry.member!,
        gear: entry.gear,
        power: weapon.power,
        attack: weapon.attack,
        cost: entry.gold,
        next: entry.next!.stat,
      }
    })
    if (before.power !== 28 || !before.next.includes("攻撃力 30"))
      throw new Error("固定武器の成長量が違う")
    await page.getByRole("button", { name: "鍛え直し", exact: true }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4500)
    )
    for (let step = 0; step < 2; step++) {
      await page.locator(".listview .slot-item.row").first().click()
      await page.evaluate(
        (time) => (window.__devStudio as StudioRuntime).advance(time),
        6000 + step * 3000
      )
      const details = page.locator(".listview")
      if (!(await details.innerText()).includes(before.next))
        throw new Error("次の攻撃力が画面にない")
      await page
        .getByRole("button", { name: "素材にして打ち直す", exact: true })
        .click()
      await page.evaluate(
        (time) => (window.__devStudio as StudioRuntime).advance(time),
        7500 + step * 3000
      )
    }
    const after = await page.evaluate((before) => {
      const game = (window.__devStudio as StudioRuntime).game!
      const weapon = game.queries.member(game.state, before.member)!.weapon!
      const entry = game.queries
        .gear(game.state)
        .find((item) => item.gear === before.gear)!
      const reforge = game.queries
        .reforges(game.state)
        .find((item) => item.gear === before.gear)!
      return {
        gold: game.state.gold,
        weapon,
        power: entry.weapon!.power,
        stat: reforge.stat,
        plus: reforge.plus,
      }
    }, before)
    if (
      after.gold !== before.gold - 2 * before.cost ||
      after.plus !== 1 ||
      after.power !== 30 ||
      after.weapon.power !== 30 ||
      after.weapon.attack <= before.attack ||
      !after.stat.includes("攻撃力 30")
    )
      throw new Error("実操作と能力表示が一致しない")
    await page.screenshot({ path: `/tmp/dnd-reforge-growth-${width}.png` })
    console.log(
      `PASS ${width}: 次の能力表示・素材2本の実使用・攻撃力28→30・戦闘Query一致`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
