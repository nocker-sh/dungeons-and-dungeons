import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import goods from "../src/lib/content/data/goods.json"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    for (const gain of [true, false]) {
      const page = await openPage(browser, viewport, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "bag",
              duration: 15000,
              width: viewport.width,
              height: viewport.height,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      const expected = await page.evaluate(
        async ({ gain, coat, vest }) => {
          const runtime = window.__devStudio as StudioRuntime
          await runtime.advance(2500)
          const game = runtime.game!
          const saved = game.save()
          const armorIds = new Set(
            game.queries
              .gear(game.state)
              .filter((gear) => gear.kind === "armor")
              .map((gear) => gear.gear)
          )
          const issue = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              phase: { type: "town" },
              gear: [
                ...saved.snapshot.gear.map((gear) =>
                  armorIds.has(gear.id) ? { ...gear, owner: null } : gear
                ),
                {
                  id: "hp-coat",
                  good: coat.id,
                  owner: null,
                  plus: 0,
                  wear: 0,
                  progress: 0,
                  weapon: null,
                },
                {
                  id: "hp-vest",
                  good: vest.id,
                  owner: null,
                  plus: 0,
                  wear: 0,
                  progress: 0,
                  weapon: null,
                },
              ],
            },
          })
          if (issue) throw issue
          const target = game.state.party.find((member) =>
            game.queries
              .equipOptions(game.state, member)
              .some((gear) => gear.gear === "hp-vest")
          )!
          if (!target) throw new Error("HP防具の装備対象がいない")
          const candidateId = gain ? "hp-vest" : "hp-coat"
          const currentId = gain ? "hp-coat" : "hp-vest"
          if (
            !Array.isArray(
              game.send({ type: "equip", gear: currentId, member: target })
            )
          )
            throw new Error("現在の防具を装備できない")
          const equipped = game.save()
          const maxHp = game.queries.member(game.state, target)!.maxHp
          const healthIssue = game.restore({
            ...equipped,
            snapshot: {
              ...equipped.snapshot,
              members: equipped.snapshot.members.map((member) =>
                member.id === target ? { ...member, hp: maxHp } : member
              ),
            },
          })
          if (healthIssue) throw healthIssue
          await runtime.advance(3500)
          const comparison = game.queries.armorComparison(
            game.state,
            target,
            candidateId
          )!
          if (
            gain
              ? comparison.after.maxHp <= comparison.before.maxHp
              : comparison.after.hp >= comparison.before.hp
          )
            throw new Error("HP変化の前提が成立しない")
          return {
            target,
            candidateId,
            name: gain ? vest.name : coat.name,
            comparison,
            save: JSON.stringify(game.save()),
          }
        },
        {
          gain,
          coat: goods.find((good) => good.slug === "coat")!,
          vest: goods.find((good) => good.slug === "gravekeeper-vest")!,
        }
      )
      await page.getByRole("button", { name: "装備", exact: true }).click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(4000)
      )
      await page
        .getByRole("button", { name: expected.name, exact: true })
        .last()
        .click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(4500)
      )
      await page
        .getByRole("button", { name: "仲間に装備", exact: true })
        .click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(5000)
      )
      const details = page.getByRole("region", {
        name: "装備後の比較",
        exact: true,
      })
      const { before, after } = expected.comparison
      if (
        !(await details.innerText()).includes(
          `現在HP（生命力） ${before.hp}/${before.maxHp} → ${after.hp}/${after.maxHp}`
        )
      )
        throw new Error("変わるHPの説明が省かれている")
      await page.keyboard.press("Escape")
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== expected.save
      )
        throw new Error("取消でHPや装備が変わる")
      await page
        .getByRole("button", { name: "仲間に装備", exact: true })
        .click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(5500)
      )
      await page
        .locator(
          `.card .hit[aria-describedby="target-detail-${expected.target}"]`
        )
        .click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(6500)
      )
      const actual = await page.evaluate((target) => {
        const game = (window.__devStudio as StudioRuntime).game!
        return game.queries.member(game.state, target)!
      }, expected.target)
      if (actual.hp !== after.hp || actual.maxHp !== after.maxHp)
        throw new Error("実際のHPが比較と一致しない")
      console.log(
        `${viewport.name}/${gain ? "gain" : "loss"}: HP変化の表示・取消・実際の装備結果が一致`
      )
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
