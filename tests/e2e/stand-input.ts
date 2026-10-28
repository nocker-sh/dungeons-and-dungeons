import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

type TestPad = { buttons: { pressed: boolean }[]; axes: number[] }
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
      const saved = await page.evaluate(() => {
        const pad: TestPad = {
          buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
          axes: [0, 0, 0, 0],
        }
        Object.assign(window, { standTestPad: pad })
        Object.defineProperty(navigator, "getGamepads", {
          configurable: true,
          value: () => [pad],
        })
        return (window.__devStudio as StudioRuntime).game!.save()
      })
      const input = async (button: number) => {
        for (const pressed of [true, false]) {
          await page.evaluate(
            ({ button, pressed }) => {
              const pad = (window as unknown as { standTestPad: TestPad })
                .standTestPad
              pad.buttons[button]!.pressed = pressed
            },
            { button, pressed }
          )
          await advance(250)
        }
      }
      const background = "[data-screen-content], .set, [data-stage-chrome]"
      const assertIsolated = async () => {
        const escaped = await page.evaluate((background) => {
          const candidates = [
            document.activeElement,
            ...document.querySelectorAll(".is-active"),
          ]
          return candidates
            .filter((el) => el?.closest(background))
            .map((el) => el?.getAttribute("aria-label") || el?.textContent)
        }, background)
        assert.deepEqual(escaped, [], `${width}/${scene}: 背後の操作へ移った`)
      }
      const selectedDestination = () =>
        page.locator('.revolver .dest[aria-selected="true"]').textContent()
      const destination =
        scene === "outskirts-deep" ? await selectedDestination() : null
      await page.locator(".formation .card .hit").first().click()
      await advance(1200)
      const equipment = page.getByRole("button", { name: "装備", exact: true })
      await equipment.focus()
      await assertIsolated()
      // 全ボタン数より多くTabを回し、逆方向も背景へ抜けないことを確かめる。
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
      for (const button of [13, 15, 12, 14]) {
        await input(button)
        await assertIsolated()
      }
      if (destination !== null)
        assert.equal(await selectedDestination(), destination)
      // 詳細側の装備をキーボードで開き、Escは詳細に一段戻る。
      // パッドはDOMのfocusを動かさないので、Tabでキーボードへ切り替える。
      for (let i = 0; i < count + 2; i++) {
        await page.keyboard.press("Tab")
        if (await equipment.evaluate((el) => el === document.activeElement))
          break
      }
      assert.ok(await equipment.evaluate((el) => el === document.activeElement))
      await page.keyboard.press("Enter")
      await advance(1200)
      assert.equal(await page.locator(".grid.rows").count(), 1)
      await page.keyboard.press("Escape")
      await advance(1200)
      assert.equal(await page.locator(".grid.rows").count(), 0)
      assert.equal(
        await page
          .getByRole("button", { name: "立ち絵を閉じる", exact: true })
          .count(),
        1
      )
      // 隊列は操作可能なまま。別の仲間に切り替えて、Bで詳細だけを閉じる。
      await page.locator(".formation .card .hit").nth(1).click()
      await advance(1200)
      assert.equal(
        await page.getByRole("button", { name: "交代", exact: true }).count(),
        1
      )
      await input(1)
      await advance(1200)
      assert.equal(
        await page
          .getByRole("button", { name: "立ち絵を閉じる", exact: true })
          .count(),
        0
      )
      assert.equal(
        await page.locator("[data-screen-content][inert], .set[inert]").count(),
        0
      )
      const screenOpacity = await page
        .locator("[data-screen-content] > .ui-layer")
        .evaluate((el) => getComputedStyle(el).opacity)
      assert.equal(screenOpacity, "1")
      if (scene === "town") {
        const entrance = page.getByRole("button", {
          name: "商店街",
          exact: true,
        })
        await entrance.focus()
        assert.ok(
          await entrance.evaluate((el) => el === document.activeElement)
        )
      } else if (scene === "shop-tools") {
        await page.getByRole("button", { name: "購入", exact: true }).focus()
        await page.keyboard.press("Enter")
        await advance(1200)
        assert.equal(await page.locator(".grid.rows").count(), 1)
        await page.keyboard.press("Escape")
        await advance(1200)
        assert.equal(await page.locator(".grid.rows").count(), 0)
      } else {
        await page.keyboard.press("ArrowUp")
        await advance()
        assert.notEqual(await selectedDestination(), destination)
      }
      // 再び開閉してもロックや透明状態を残さない。
      await page.locator(".formation .card .hit").first().click()
      await advance(1200)
      await equipment.focus()
      await page.screenshot({
        path: `/tmp/dnd-stand-input-${width}-${scene}.png`,
      })
      await page.keyboard.press("Escape")
      await advance(1200)
      assert.equal(
        await page
          .getByRole("button", { name: "立ち絵を閉じる", exact: true })
          .count(),
        0
      )
      assert.equal(
        await page.locator("[data-screen-content][inert], .set[inert]").count(),
        0
      )
      assert.deepEqual(
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).game!.save()
        ),
        saved
      )
      console.log(
        `${width}/${scene}: Tab・矢印・パッドの背景操作防止、装備・仲間切替・取消・背景復帰、保存保持 OK`
      )
      await page.close()
    }
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
