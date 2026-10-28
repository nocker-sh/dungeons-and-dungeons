import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import goods from "@/content/data/goods.json"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const width of [390, 1280]) {
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
    const potion = goods.find((good) => good.slug === "potion")!
    const target = await page.evaluate((potion) => {
      const game = (window.__devStudio as StudioRuntime).game!
      const saved = game.save()
      const target = game.state.party[0]!
      const hp = game.queries.member(game.state, target)!.maxHp - 5
      const issue = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          bag: [
            ...saved.snapshot.bag.filter((entry) => entry.good !== potion.id),
            { good: potion.id, count: 3 },
          ],
          provisions: [{ good: potion.id, count: 3 }],
          members: saved.snapshot.members.map((member) => ({
            ...member,
            hp: game.queries.member(game.state, member.id)!.maxHp,
          })),
        },
      })
      if (issue) throw issue
      return { id: target, hp }
    }, potion)
    await advance()
    await page.getByRole("button", { name: "アイテム", exact: true }).click()
    await advance()
    const use = page.getByRole("button", { name: "使う", exact: true })
    assert.equal(await use.isDisabled(), true, "全員が全快なら使うを無効にする")
    await page.screenshot({
      path: `/tmp/dnd-battle-item-disabled-${width}.png`,
    })
    const fullHpSave = await page.evaluate(() =>
      JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
    )
    await page.getByRole("listbox", { name: "アイテム", exact: true }).focus()
    for (const key of ["Enter", "Space"]) {
      await page.keyboard.press(key)
      await advance()
      assert.equal(await page.locator(".target-dim").count(), 0)
      assert.equal(
        await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        ),
        fullHpSave,
        "使えない道具の決定で状態が変わった"
      )
    }
    await page.evaluate(({ id, hp }) => {
      const game = (window.__devStudio as StudioRuntime).game!
      const saved = game.save()
      const issue = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          members: saved.snapshot.members.map((member) =>
            member.id === id ? { ...member, hp } : member
          ),
        },
      })
      if (issue) throw issue
    }, target)
    await advance()
    assert.equal(
      await use.isEnabled(),
      true,
      "回復対象ができたら使うを有効にする"
    )
    await page.screenshot({ path: `/tmp/dnd-battle-item-enabled-${width}.png` })
    await page.getByRole("button", { name: "‹ もどる", exact: true }).focus()
    await page.keyboard.press("Enter")
    await advance()
    const saved = await page.evaluate(() =>
      JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
    )
    const openItems = async () => {
      await page.getByRole("button", { name: "アイテム", exact: true }).click()
      await advance()
    }
    for (const key of ["Enter", "Space"]) {
      await openItems()
      await page.getByRole("button", { name: "‹ もどる", exact: true }).focus()
      await page.keyboard.press(key)
      await advance()
      assert.equal(
        await page
          .getByRole("listbox", { name: "武器のワザと祝福", exact: true })
          .count(),
        1,
        `戻るに${key}でアイテムを選ばず指示へ戻る`
      )
      assert.equal(
        await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        ),
        saved,
        "戻る操作で持ち物や手番が変わった"
      )
    }
    await page.evaluate(() => {
      const pad = {
        index: 0,
        buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
        axes: [0, 0],
      }
      Object.assign(window, { pickerTestPad: pad })
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [pad],
      })
    })
    const padA = async (pressed: boolean) => {
      await page.evaluate((pressed) => {
        ;(
          window as unknown as {
            pickerTestPad: { buttons: { pressed: boolean }[] }
          }
        ).pickerTestPad.buttons[0]!.pressed = pressed
      }, pressed)
      await advance()
    }
    await openItems()
    await page.getByRole("button", { name: "‹ もどる", exact: true }).focus()
    await padA(true)
    assert.equal(
      await page
        .getByRole("listbox", { name: "武器のワザと祝福", exact: true })
        .count(),
      1,
      "パッドAも戻るボタンを実行する"
    )
    await padA(false)
    await openItems()
    // 一覧自体のEnterとパッドAは、選択中の道具の対象選びへ進む。
    for (const input of ["Enter", "padA"]) {
      await page.getByRole("listbox", { name: "アイテム", exact: true }).focus()
      if (input === "padA") await padA(true)
      else {
        await page.keyboard.press(input)
        await advance()
      }
      assert.equal(await page.locator(".target-dim").count(), 1)
      assert.equal(
        await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        ),
        saved
      )
      await page.keyboard.press("Escape")
      await advance()
      if (input === "padA") await padA(false)
      assert.equal(
        await page
          .getByRole("listbox", { name: "アイテム", exact: true })
          .count(),
        1
      )
      assert.equal(
        await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        ),
        saved,
        "対象取消で手番や道具が変わった"
      )
    }
    await page.getByRole("listbox", { name: "アイテム", exact: true }).focus()
    await page.keyboard.press("Enter")
    await advance()
    const beforeTurn = await page.evaluate(
      () =>
        (window.__devStudio as StudioRuntime).game!.queries.battle(
          (window.__devStudio as StudioRuntime).game!.state
        )!.turn
    )
    await page
      .locator(".formation .card .hit")
      .first()
      .evaluate((button) => {
        ;(button as HTMLButtonElement).click()
        ;(button as HTMLButtonElement).click()
      })
    const after = await page.evaluate(
      ({ target, potion }) => {
        const game = (window.__devStudio as StudioRuntime).game!
        return {
          hp: game.queries.member(game.state, target)!.hp,
          count: game.state.bag.find((entry) => entry.good === potion)!.count,
          turn: game.queries.battle(game.state)!.turn,
        }
      },
      { target: target.id, potion: potion.id }
    )
    assert.equal(after.hp, target.hp + 5)
    assert.equal(after.count, 2, "対象を連打しても1個だけ使う")
    assert.equal(after.turn, beforeTurn + 1, "対象を連打しても手番は1回だけ")
    console.log(
      `${width}: 道具の使用可否・Enter/Space/パッドAの戻る・対象選択・無料取消・連打時1個/1手番 OK`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
