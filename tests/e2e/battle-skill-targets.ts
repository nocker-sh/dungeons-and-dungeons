import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { waitForStudio } from "@/scripts/studio-browser"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import skills from "@/content/data/skills.json"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
try {
  for (const width of [390, 1280]) {
    for (const slug of ["dungeon-blessing-4", "dungeon-blessing-5"]) {
      const errors: string[] = []
      const page = await openPage(browser, { width, height: 844 }, errors)
      await page.routeWebSocket("**/*", () => {})
      const skill = skills.find((entry) => entry.slug === slug)!
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({ width, duration: 15000, hp: [100, 0, 100] })
          )
      )
      assert.equal((await waitForStudio(page)).error, undefined)
      const fixture = await page.evaluate(async (skill) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(3000)
        const game = runtime.game!
        const saved = game.save()
        if (saved.snapshot.phase.type !== "battle")
          throw new Error("戦闘ではない")
        const [hero, fallen, actor] = saved.snapshot.party
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            members: saved.snapshot.members.map((member) =>
              member.id === actor ? { ...member, blessing: skill.id } : member
            ),
            phase: {
              ...saved.snapshot.phase,
              battle: {
                ...saved.snapshot.phase.battle,
                turn: 0,
                order: [
                  { kind: "member", id: actor },
                  ...saved.snapshot.phase.battle.order.filter(
                    (ref) => ref.kind === "foe"
                  ),
                ],
              },
            },
          },
        })
        if (issue) throw issue
        await runtime.advance(5000)
        const commands = game.queries.commands(game.state, actor)!
        return {
          last: commands.weaponSkills.length,
          names: (skill.revive ? [fallen] : [hero, actor]).map(
            (id) => game.queries.member(game.state, id)!.name
          ),
          save: JSON.stringify(game.save()),
        }
      }, skill)
      const list = page.getByRole("listbox", {
        name: "武器のワザと祝福",
        exact: true,
      })
      await list.focus()
      for (let index = 0; index < fixture.last; index++)
        await page.keyboard.press("ArrowDown")
      await page.evaluate(() => window.__devStudio!.advance(5500))
      const selected = list.getByRole("option", { selected: true })
      assert.ok(
        (await selected.getAttribute("aria-label"))?.includes(skill.name)
      )
      await selected.click()
      await page.evaluate(() => window.__devStudio!.advance(6000))
      assert.equal(await page.locator(".target-dim").count(), 1)
      const enabled = await page
        .locator(".formation .hit:enabled")
        .evaluateAll((cards) =>
          cards.map((card) => card.getAttribute("aria-label")!.split(" HP")[0])
        )
      assert.deepEqual(enabled, fixture.names)
      await page.screenshot({
        path: `/tmp/dnd-skill-targets-${slug}-${width}.png`,
      })
      await page.keyboard.press("Escape")
      await page.evaluate(() => window.__devStudio!.advance(6500))
      assert.equal(await page.locator(".target-dim").count(), 0)
      assert.equal(
        await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        ),
        fixture.save
      )
      assert.deepEqual(errors, [])
      await page.close()
      console.log(
        `${width}px: ${skill.name}の対象だけを選択でき、取消で状態を変えない`
      )
    }
  }
} finally {
  await browser.close()
}
