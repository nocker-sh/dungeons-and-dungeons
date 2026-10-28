import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import { contentId } from "@/lib/wiz/testing/content-id"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

declare global {
  interface Window {
    __suppliesPad: {
      index: number
      axes: number[]
      buttons: { pressed: boolean }[]
    }
  }
}

const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    for (const scene of ["bag", "outskirts-deep"]) {
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
      let time = 4000
      const advance = async (ms = 250) => {
        time += ms
        await page.evaluate(
          (time) => (window.__devStudio as StudioRuntime).advance(time),
          time
        )
      }
      const before = await page.evaluate(async (potion) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(3500)
        const game = runtime.game!
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            bag: [{ good: potion, count: 3 }],
            provisions: [],
          },
        })
        if (issue) throw issue
        await runtime.advance(4000)
        window.__suppliesPad = {
          index: 0,
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
        }
        Object.defineProperty(navigator, "getGamepads", {
          configurable: true,
          value: () => [window.__suppliesPad],
        })
        return game.save()
      }, contentId("potion"))
      const pad = async (button: number) => {
        for (const pressed of [true, false]) {
          await page.evaluate(
            ({ button, pressed }) => {
              window.__suppliesPad.buttons[button]!.pressed = pressed
            },
            { button, pressed }
          )
          await advance()
        }
      }
      const trigger = page.getByRole("button", {
        name: "持ち出しを準備",
        exact: true,
      })
      const start =
        scene === "bag"
          ? page.locator(".listview.bag .tabbtn").first()
          : page.locator('.revolver .dest[aria-selected="true"]')
      await start.focus()
      for (let step = 0; step < 20; step++) {
        await pad(scene === "bag" ? 12 : 5)
        if (
          await trigger.evaluate((node) => node.classList.contains("is-active"))
        )
          break
      }
      assert.equal(
        await trigger.evaluate((node) => node.classList.contains("is-active")),
        true,
        `${width}/${scene}: パッドで持ち出し準備を選べない`
      )
      if (scene === "outskirts-deep") {
        await pad(4)
        assert.equal(
          await trigger.evaluate((node) =>
            node.classList.contains("is-active")
          ),
          false,
          "Lで前の項目へ戻れない"
        )
        await pad(5)
        assert.equal(
          await trigger.evaluate((node) =>
            node.classList.contains("is-active")
          ),
          true,
          "Rで元の項目へ戻れない"
        )
      }
      const outlined = () =>
        page.locator("button.is-active").evaluate((node) => {
          const style = getComputedStyle(node)
          return (
            style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2
          )
        })
      assert.equal(
        await outlined(),
        true,
        "選択中の持ち出しボタンが見分けられない"
      )
      await pad(0)
      const dialog = page.getByRole("dialog", {
        name: "倉庫と手持ち",
        exact: true,
      })
      await dialog.waitFor()
      await pad(13)
      const add = dialog.getByRole("button", {
        name: "回復薬を持ち出す",
        exact: true,
      })
      assert.equal(
        await add.evaluate((node) => node.classList.contains("is-active")),
        true
      )
      assert.equal(
        await add.evaluate((node) => node === document.activeElement),
        true,
        "パッドの選択とキーボードのフォーカスが別の操作を指している"
      )
      assert.equal(
        await outlined(),
        true,
        "選択中の持ち出す操作が見分けられない"
      )
      // 無効な「戻す」と背面を飛ばし、窓の端で前後に循環する。
      await pad(5)
      assert.equal(
        await dialog
          .getByRole("button", { name: "持ち出しを閉じる" })
          .evaluate((node) => node.classList.contains("is-active")),
        true
      )
      await pad(4)
      assert.equal(
        await add.evaluate((node) => node.classList.contains("is-active")),
        true
      )
      await pad(0)
      const packed = await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      )
      assert.deepEqual(packed.snapshot, {
        ...before.snapshot,
        provisions: [{ good: contentId("potion"), count: 1 }],
      })
      // 在庫をすべて持ち出した後の連打で「閉じる」へ飛ばさない。
      await pad(0)
      await pad(0)
      assert.equal(await add.isDisabled(), true)
      const fullyPacked = await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      )
      assert.deepEqual(fullyPacked.snapshot, {
        ...before.snapshot,
        provisions: [{ good: contentId("potion"), count: 3 }],
      })
      await pad(0)
      assert.equal(
        await dialog.isVisible(),
        true,
        "在庫切れの後の決定で準備画面が閉じた"
      )
      assert.equal(
        await add.evaluate((node) => node.classList.contains("is-active")),
        true,
        "在庫切れで別の操作に選択が飛んだ"
      )
      assert.deepEqual(
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).game!.save()
        ),
        fullyPacked
      )
      await pad(4)
      const remove = dialog.getByRole("button", {
        name: "回復薬を倉庫へ戻す",
        exact: true,
      })
      assert.equal(
        await remove.evaluate((node) => node.classList.contains("is-active")),
        true,
        "無効になった追加操作からLで戻せない"
      )
      for (let index = 0; index < 3; index++) await pad(0)
      assert.equal(await remove.isDisabled(), true)
      await pad(0)
      assert.equal(
        await dialog.isVisible(),
        true,
        "手持ちが空になった後の決定で準備画面が閉じた"
      )
      assert.deepEqual(
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).game!.save()
        ),
        before
      )
      await pad(15)
      assert.equal(
        await add.evaluate((node) => node.classList.contains("is-active")),
        true,
        "無効になった戻す操作から右で追加を選べない"
      )
      await pad(0)
      assert.deepEqual(
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).game!.save()
        ),
        packed
      )
      if (width === 390 && scene === "bag")
        await page.screenshot({ path: "/tmp/dnd-supplies-gamepad.png" })
      await pad(1)
      await dialog.waitFor({ state: "detached" })
      assert.equal(
        await trigger.evaluate((node) => node.classList.contains("is-active")),
        true,
        "閉じた後に持ち出しボタンへ選択が戻らない"
      )
      await pad(0)
      await dialog.waitFor()
      await page.keyboard.press("Escape")
      await advance()
      await dialog.waitFor({ state: "detached" })
      await page.keyboard.press("Enter")
      await advance()
      await dialog.waitFor()
      assert.deepEqual(
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).game!.save()
        ),
        packed,
        "再開閉で出撃や持ち替えが余分に実行された"
      )
      console.log(
        `${width}/${scene}: パッドで開く・選択枠・在庫切れ/手持ちゼロの連打・L/右で操作再開・Bで戻る・A/Enterで再開・資産保持 OK`
      )
      await page.close()
    }
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
