import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { tap } from "@/tests/e2e/tap"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import goods from "@/content/data/goods.json"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

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
            duration: 60000,
            width,
            height: 844,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    let time = 5000
    const advance = async () => {
      time += 1000
      await page.evaluate(
        async (time) => window.__devStudio!.advance(time),
        time
      )
    }
    await advance()
    const fixture = await page.evaluate((goods) => {
      const game = (window.__devStudio as StudioRuntime).game!
      const saved = game.save()
      const stock = goods
        .filter((good) => good.kind === "item" && good.effect)
        .slice(0, 7)
        .map((good) => ({ good: good.id, count: 1 }))
      const issue = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          bag: stock,
          provisions: stock.map((entry) => ({ ...entry })),
        },
      })
      if (issue) throw issue
      const actor = game.queries.battle(game.state)!.current!
      if (actor.kind !== "member") throw new Error("仲間の手番ではない")
      const commands = game.queries.commands(game.state, actor.id)!
      const index = commands.weaponSkills.findIndex(
        (skill, index) => index > 0 && skill.usable && skill.target === "foe"
      )
      if (
        index < 0 ||
        commands.items.length <= commands.weaponSkills.length + 1
      )
        throw new Error("選択位置を検証できるワザと道具が足りない")
      return {
        actor: actor.id,
        index,
        skill: commands.weaponSkills[index]!,
        save: JSON.stringify(game.save()),
      }
    }, goods)
    await advance()
    const weapons = page.getByRole("listbox", {
      name: "武器のワザと祝福",
      exact: true,
    })
    await weapons.focus()
    for (let i = 0; i < fixture.index; i++)
      await page.keyboard.press("ArrowDown")
    await advance()
    const selected = await weapons
      .getByRole("option", { selected: true })
      .getAttribute("aria-label")
    assert.ok(selected?.includes(fixture.skill.name))

    for (const menu of ["アイテム", "スキル"]) {
      await tap(
        page,
        page.getByRole("button", { name: menu === "スキル" ? /^スキル/ : menu })
      )
      await advance()
      const list = page.getByRole("listbox", { name: menu, exact: true })
      await list.focus()
      const count = await list.locator('[role="option"]').count()
      for (let i = 1; i < count; i++) await page.keyboard.press("ArrowDown")
      await advance()
      await page.getByRole("button", { name: "‹ もどる", exact: true }).focus()
      await page.keyboard.press("Enter")
      await advance()
      assert.equal(
        await weapons.getByRole("option", { selected: true }).count(),
        1,
        `${menu}から戻ると武器の選択が消えた`
      )
      assert.equal(
        await weapons
          .getByRole("option", { selected: true })
          .getAttribute("aria-label"),
        selected,
        `${menu}から戻ると選んだワザが変わった`
      )
      assert.equal(
        await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        ),
        fixture.save,
        "選択と取消で保存状態が変わった"
      )
    }
    await page.locator('[data-foe-pick][data-action="放つ"]').focus()
    await page.keyboard.press("Enter")
    const left = await page.evaluate(({ actor, skill }) => {
      const game = (window.__devStudio as StudioRuntime).game!
      return game.queries
        .commands(game.state, actor)!
        .weaponSkills.find((entry) => entry.id === skill.id)!.left
    }, fixture)
    assert.equal(
      left,
      fixture.skill.left! - 1,
      "戻る前に選んだワザを実行できなかった"
    )
    console.log(
      `${width}px: 道具・スキルから戻っても武器の選択と状態を保持し、選んだワザを実行`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
