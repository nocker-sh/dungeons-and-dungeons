import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import goods from "@/content/data/goods.json"

type TestPad = {
  index: number
  buttons: { pressed: boolean }[]
  axes: number[]
}
const potion = goods.find((good) => good.slug === "potion")!
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    for (const scene of ["town", "shop-tools", "outskirts-deep"]) {
      const page = await openPage(browser, { width, height: 844 }, errors)
      await page.routeWebSocket("**/*", () => {})
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({ scene, width, height: 844, duration: 60000 })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      let time = 3500
      const advance = async (ms = 500) => {
        time += ms
        await page.evaluate(
          async (time) => window.__devStudio!.advance(time),
          time
        )
      }
      await advance()
      const expected = await page.evaluate(async (potion) => {
        const game = (window.__devStudio as StudioRuntime).game!
        const saved = game.save()
        const target = saved.snapshot.party[1]
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            bag: [
              ...saved.snapshot.bag.filter((entry) => entry.good !== potion),
              { good: potion, count: 3 },
            ],
            provisions: [],
            members: saved.snapshot.members.map((member) =>
              member.id === target
                ? { ...member, hp: Math.ceil(member.hp / 2) }
                : member
            ),
          },
        })
        if (issue) throw issue
        const item = game.queries
          .items(game.state)
          .find((entry) => entry.id === potion)!
        const pad: TestPad = {
          index: 0,
          buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
          axes: [0, 0, 0, 0],
        }
        Object.assign(window, { bagTestPad: pad })
        Object.defineProperty(navigator, "getGamepads", {
          configurable: true,
          value: () => [pad],
        })
        return {
          save: game.save(),
          target,
          eligible: item.targets,
          hp: item.healing!.find((entry) => entry.id === target)!.after,
        }
      }, potion.id)
      assert.deepEqual(expected.eligible, [expected.target])
      await advance()
      const screen = () => page.locator("[data-screen-content]").textContent()
      const beforeScreen = await screen()
      const destination = await page
        .locator('.revolver .dest[aria-selected="true"]')
        .allTextContents()
      const save = () =>
        page.evaluate(() => (window.__devStudio as StudioRuntime).game!.save())
      const input = async (button: number) => {
        for (const pressed of [true, false]) {
          await page.evaluate(
            ({ button, pressed }) => {
              ;(
                window as unknown as { bagTestPad: TestPad }
              ).bagTestPad.buttons[button]!.pressed = pressed
            },
            { button, pressed }
          )
          await advance(250)
        }
      }
      const open = async () => {
        await page.getByRole("button", { name: "バッグ", exact: true }).click()
        await advance(1200)
        assert.equal(await page.locator(".listview.bag").count(), 1)
      }
      const assertIsolated = async () => {
        assert.deepEqual(
          await page.evaluate(() =>
            [document.activeElement, ...document.querySelectorAll(".is-active")]
              .filter((el) =>
                el?.closest("[data-screen-content], .set, .formation .card")
              )
              .map((el) => el?.getAttribute("aria-label") || el?.textContent)
          ),
          [],
          `${width}/${scene}: バッグの背後へ入力が移った`
        )
      }
      await open()
      const count = await page.locator(".game button").count()
      for (const key of ["Tab", "Shift+Tab"]) {
        for (let i = 0; i < count + 2; i++) {
          await page.keyboard.press(key)
          await assertIsolated()
        }
      }
      for (const key of ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"]) {
        await page.keyboard.press(key)
        await advance(250)
        await assertIsolated()
      }
      for (const button of [13, 15, 12, 14, 5, 4]) {
        await input(button)
        await assertIsolated()
      }
      assert.deepEqual(
        await page
          .locator('.revolver .dest[aria-selected="true"]')
          .allTextContents(),
        destination
      )
      // 連続した取消を、閉じる演出中の背景へ流さない。
      for (const key of ["Escape", "Backspace"]) {
        if (key === "Backspace") await open()
        await page.keyboard.press(key)
        await page.keyboard.press(key)
        await advance(1200)
        assert.equal(await page.locator(".listview.bag").count(), 0)
        assert.equal(await screen(), beforeScreen)
        assert.deepEqual(await save(), expected.save)
      }
      await open()
      const choose = async () => {
        await page
          .getByRole("button", { name: potion.name, exact: true })
          .click()
        await advance()
        await page.getByRole("button", { name: "使う", exact: true }).click()
        await advance(1200)
        assert.equal(await page.locator(".target-dim").count(), 1)
      }
      await choose()
      for (const key of ["Tab", "Shift+Tab"]) {
        for (let i = 0; i < 6; i++) {
          await page.keyboard.press(key)
          assert.ok(
            await page.evaluate(() =>
              document.activeElement?.matches(
                ".target-cancel, .formation .card .hit:not(:disabled)"
              )
            )
          )
        }
      }
      for (const button of [4, 5]) {
        for (let step = 0; step < 4; step++) {
          await input(button)
          assert.ok(
            await page.evaluate(() =>
              document
                .querySelector("button.is-active")
                ?.matches(
                  ".target-cancel, .formation .card .hit:not(:disabled)"
                )
            ),
            "L/Rで対象選択の背面へ移った"
          )
        }
      }
      // Bは対象選択だけを取り消し、道具もHPも変えない。
      await input(1)
      await advance()
      assert.equal(await page.locator(".target-dim").count(), 0)
      assert.equal(await page.locator(".listview.bag").count(), 1)
      assert.deepEqual(await save(), expected.save)
      await choose()
      const target = page.locator(
        `.card .hit[aria-describedby="target-detail-${expected.target}"]`
      )
      await target.focus()
      await page.keyboard.press("Enter")
      await advance(1200)
      assert.equal(await page.locator(".target-dim").count(), 0)
      const after = await save()
      assert.deepEqual(after, {
        ...expected.save,
        snapshot: {
          ...expected.save.snapshot,
          bag: expected.save.snapshot.bag.map((entry) =>
            entry.good === potion.id
              ? { ...entry, count: entry.count - 1 }
              : entry
          ),
          members: expected.save.snapshot.members.map((member) =>
            member.id === expected.target
              ? { ...member, hp: expected.hp }
              : member
          ),
        },
      })
      await input(1)
      await advance(1200)
      assert.equal(await page.locator(".listview.bag").count(), 0)
      assert.equal(await screen(), beforeScreen)
      assert.equal(
        await page.locator("[data-screen-content][inert], .set[inert]").count(),
        0
      )
      assert.deepEqual(await save(), after)
      console.log(
        `${width}/${scene}: バッグの入力範囲、Esc/Backspace/B、対象取消、回復薬1個の使用、背景復帰 OK`
      )
      await page.close()
    }
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
