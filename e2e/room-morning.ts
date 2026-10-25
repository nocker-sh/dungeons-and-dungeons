import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
import rooms from "../src/lib/content/data/rooms.json"
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280])
    for (const room of rooms) {
      const page = await openPage(browser, { width, height: 760 }, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: `room-${room.slug}`,
              duration: 30000,
              width,
              height: 760,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      const before = await page.evaluate(async () => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(3500)
        const game = runtime.game!
        const saved = game.save()
        const armorIds = game.queries
          .gear(game.state)
          .filter((entry) => entry.armor)
          .map((entry) => entry.gear)
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            gold: 1000,
            gear: saved.snapshot.gear.map((entry) =>
              armorIds.includes(entry.id) ? { ...entry, wear: 1 } : entry
            ),
            members: saved.snapshot.members.map((member) => ({
              ...member,
              hp: 1,
              exp: 0,
            })),
          },
        })
        if (issue) throw issue
        await runtime.advance(4500)
        return {
          save: game.save(),
          party: game.state.party.map((id) =>
            game.queries.member(game.state, id)!
          ),
        }
      })
      await page.getByRole("button", { name: "泊まる", exact: true }).click()
      let slept = false
      let sleepSeenAt: number | null = null
      let shown = false
      const label = room.heal === "full" ? "全回復！" : "回復！"
      for (let time = 4700; time <= 27000; time += 200) {
        await page.evaluate(
          (time) => (window.__devStudio as StudioRuntime).advance(time),
          time
        )
        const sleep = page.getByRole("button", { name: "寝る", exact: true })
        if (!slept && (await sleep.isVisible())) {
          sleepSeenAt ??= time
          if (time - sleepSeenAt >= 1000) {
            await sleep.click()
            slept = true
          }
        }
        const burst = page
          .locator("span.comic")
          .filter({ hasText: new RegExp(`^${label}$`) })
        if (await burst.count()) {
          await page.evaluate(
            (time) => (window.__devStudio as StudioRuntime).advance(time + 650),
            time
          )
          const box = await burst.boundingBox()
          if (
            !(await burst.isVisible()) ||
            !box ||
            box.width < 30 ||
            box.height < 30
          )
            throw new Error("朝の回復文字が表示されない")
          if (
            room.heal !== "full" &&
            (await page
              .locator("span.comic")
              .filter({ hasText: /^全回復！$/ })
              .count())
          )
            throw new Error("半回復で全回復表示")
          await page.screenshot({
            path: `/tmp/dnd-room-morning-${width}-${room.slug}.png`,
          })
          shown = true
          break
        }
      }
      if (!shown) throw new Error(`${width}/${room.slug}の朝演出がない`)
      const after = await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      )
      if (after.snapshot.gold !== 1000 - room.price)
        throw new Error("宿の費用が違う")
      if (
        JSON.stringify(after.snapshot.gear) !==
        JSON.stringify(before.save.snapshot.gear)
      )
        throw new Error("宿で防具が変わる")
      for (const member of before.party) {
        const healed = after.snapshot.members.find(
          (entry) => entry.id === member.id
        )!
        const expected =
          room.heal === "full"
            ? member.maxHp
            : Math.min(member.maxHp, 1 + Math.ceil(member.maxHp / 2))
        if (healed.hp !== expected || healed.lv !== member.lv)
          throw new Error("実回復量かレベルが違う")
      }
      console.log(
        `${width}/${room.slug}: 朝の${label}・実回復量・費用・防具保持`
      )
      await page.close()
    }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
