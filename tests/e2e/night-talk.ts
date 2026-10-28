import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import { nightTalks } from "@/content/looks/night-talks"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { startedState } from "@/lib/wiz/testing/started-state"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const definition = new GameDefinition(realContent())
const initial = startedState(definition)
const talk = nightTalks().find((talk) =>
  talk.pair.every((id) => initial.party.includes(id))
)!
assert.ok(talk, "初期編成で使える二人雑談がない")
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280])
    for (const [
      choice,
      [label, liked, reply],
    ] of talk.choice.options.entries()) {
      const page = await openPage(browser, { width, height: 844 }, errors)
      await page.routeWebSocket("**/*", () => {})
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "room-normal",
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
      const advance = async (ms = 800) => {
        time += ms
        await page.evaluate((time) => window.__devStudio!.advance(time), time)
      }
      await advance()
      const before = await page.evaluate(() => {
        const game = (window.__devStudio as StudioRuntime).game!
        const saved = game.save()
        const error = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            gold: 1000,
            members: saved.snapshot.members.map((member) => ({
              ...member,
              exp: 0,
            })),
          },
        })
        if (error) throw error
        return game.save()
      })
      assert.deepEqual(before.snapshot.party, initial.party)
      await page.getByRole("button", { name: "泊まる", exact: true }).click()
      const choices = page.getByRole("group", {
        name: talk.choice.ask,
        exact: true,
      })
      let found = false
      for (let step = 0; step < 60 && time < 56000; step++) {
        await advance()
        if (await choices.count()) {
          found = true
          break
        }
        const ask = page.getByRole("button", { name: "雑談する", exact: true })
        if (await ask.count()) {
          await advance()
          await ask.click()
          continue
        }
        const dialog = page.locator("[data-conversation-dialog]")
        const ready = dialog.locator("[data-conversation-ready]")
        if (await ready.count()) await ready.click()
        else {
          const answer = dialog.getByRole("group").getByRole("button").first()
          if (await answer.count()) {
            await advance()
            await answer.click()
          }
        }
      }
      assert.ok(found, "宿泊後に初期の二人雑談が出ない")
      await advance()
      const afterRest = await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      )
      const button = choices.getByRole("button", { name: label, exact: true })
      const visible = await button.evaluate((el) => {
        const box = el.getBoundingClientRect()
        return (
          box.left >= 0 &&
          box.right <= innerWidth &&
          box.top >= 0 &&
          box.bottom <= innerHeight
        )
      })
      assert.ok(visible, `${width}: 雑談の返答が画面からはみ出した`)
      await button.click()
      await advance()
      assert.ok(
        (await page.locator("[data-conversation-dialog]").innerText()).includes(
          reply
        )
      )
      let chatted = false
      for (let step = 0; step < 12; step++) {
        const ready = page.locator("[data-conversation-ready]")
        if (await ready.count()) await ready.click()
        await advance(300)
        chatted = await page.evaluate(
          (liked) =>
            (window.__devStudio as StudioRuntime).game!.state.chatted.includes(
              liked
            ),
          liked
        )
        if (chatted) break
      }
      assert.ok(chatted, "返答後に親しさが保存されない")
      const burst = page
        .locator("span.comic")
        .filter({ hasText: /^親しさ \+1$/ })
      assert.equal(await burst.count(), 1)
      assert.ok(
        await burst.evaluate((el) => {
          const box = el.getBoundingClientRect()
          return (
            box.left >= 0 &&
            box.right <= innerWidth &&
            box.top >= 0 &&
            box.bottom <= innerHeight &&
            parseFloat(getComputedStyle(el).fontSize) >= 14
          )
        }),
        `${width}/${choice}: 親しさ+1が読める大きさで画面内に収まらない`
      )
      await page.screenshot({
        path: `/tmp/dnd-night-talk-${width}-${choice}.png`,
      })
      const after = await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      )
      for (const member of after.snapshot.members)
        assert.equal(
          member.like,
          afterRest.snapshot.members.find((entry) => entry.id === member.id)!
            .like + (member.id === liked ? 1 : 0)
        )
      assert.equal(after.snapshot.gold, afterRest.snapshot.gold)
      assert.deepEqual(after.snapshot.bag, afterRest.snapshot.bag)
      assert.deepEqual(after.snapshot.gear, afterRest.snapshot.gear)
      const restored = definition.create()
      assert.equal(restored.restore(after), undefined)
      assert.equal(restored.queries.canChatWith(restored.state, liked), false)
      const saved = restored.save()
      assert.ok(!Array.isArray(restored.send({ type: "chat", liked })))
      assert.deepEqual(restored.save(), saved)
      const room = page.getByRole("button", { name: "普通の部屋", exact: true })
      for (let step = 0; step < 40 && !(await room.count()); step++)
        await advance(500)
      assert.equal(await room.count(), 1, "雑談が終わっても朝の宿へ戻れない")
      const morning = await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      )
      assert.deepEqual(morning.snapshot.members, after.snapshot.members)
      assert.equal(morning.snapshot.gold, after.snapshot.gold)
      console.log(
        `${width}/${choice}: 初期編成で宿泊→雑談→朝・親しさ+1・資産保持・保存復元・重複拒否 OK`
      )
      await page.close()
    }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
