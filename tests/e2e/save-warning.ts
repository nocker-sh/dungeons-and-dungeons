import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import { contentId } from "@/lib/wiz/testing/content-id"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

type SaveProbe = {
  fail: boolean
  attempts: number
  stored: string | null
  finish?: () => void
}
declare global {
  interface Window {
    __saveProbe: SaveProbe
    __saveTestPad: {
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
    for (const mode of ["sync", "async"] as const) {
      const page = await openPage(browser, { width, height: 900 }, errors)
      let storageModule = ""
      page.on("request", (request) => {
        if (
          new URL(request.url()).pathname === "/client/game/memory-storage.ts"
        )
          storageModule = request.url()
      })
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "town",
              duration: 15000,
              width,
              height: 900,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      await page.evaluate(
        async ({ mode, shop, good, storageModule }) => {
          const runtime = window.__devStudio as StudioRuntime
          await runtime.advance(2500)
          // 各ページのメモリ保存だけを失敗させ、実際の保存先には触れない。
          const { MemoryStorage } = await import(storageModule)
          const original = MemoryStorage.prototype.write
          const probe: SaveProbe = { fail: true, attempts: 0, stored: null }
          window.__saveProbe = probe
          MemoryStorage.prototype.write = function (value: string) {
            probe.attempts++
            if (probe.fail) {
              const error = new DOMException(
                "保存容量不足",
                "QuotaExceededError"
              )
              if (mode === "async") return Promise.reject(error)
              throw error
            }
            const save = () => {
              original.call(this, value)
              probe.stored = value
            }
            if (mode === "sync") return save()
            return new Promise<void>((resolve) => {
              probe.finish = () => {
                save()
                resolve()
              }
            })
          }
          const game = runtime.game!
          for (let index = 0; index < 2; index++) {
            const result = game.send({ type: "buy", shop, good })
            if (!Array.isArray(result)) throw result
          }
          await runtime.advance(3500)
        },
        {
          mode,
          shop: contentId("tools"),
          good: contentId("rope"),
          storageModule,
        }
      )
      const warning = page.locator("[data-save-warning]")
      await warning.waitFor()
      if (width === 390 && mode === "sync")
        await page.screenshot({ path: "/tmp/dnd-save-warning.png" })
      assert.match((await warning.textContent()) ?? "", /保存できていません/)
      const button = warning.getByRole("button", { name: "もう一度保存" })
      const bounds = await button.boundingBox()
      assert.ok(
        bounds &&
          bounds.height >= 44 &&
          bounds.x >= 0 &&
          bounds.x + bounds.width <= width
      )
      const before = await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )
      await button.evaluate((element) => {
        if (element instanceof HTMLButtonElement) element.click()
      })
      await page.waitForFunction(() => window.__saveProbe.attempts === 3)
      await button.waitFor()
      assert.equal(await warning.count(), 1, "再失敗で知らせが消える")
      await page.evaluate(() => {
        window.__saveProbe.fail = false
      })
      let time = 3500
      if (mode === "async") {
        await page.getByRole("button", { name: "バッグ", exact: true }).click()
        time += 1000
        await page.evaluate(
          (time) => (window.__devStudio as StudioRuntime).advance(time),
          time
        )
        await page.locator(".listview.bag").waitFor()
        await page.locator(".listview.bag .slot-item").first().focus()
      }
      const pad = async (button: number) => {
        for (const pressed of [true, false]) {
          time += 250
          await page.evaluate(
            async ({ button, pressed, time }) => {
              window.__saveTestPad.buttons[button]!.pressed = pressed
              await (window.__devStudio as StudioRuntime).advance(time)
            },
            { button, pressed, time }
          )
        }
      }
      const screen = await page.locator("[data-screen-content]").textContent()
      if (mode === "async") {
        await page.evaluate(() => {
          window.__saveTestPad = {
            index: 0,
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
          }
          Object.defineProperty(navigator, "getGamepads", {
            configurable: true,
            value: () => [window.__saveTestPad],
          })
        })
        // バッグ内の操作からRで順に移り、バッグを閉じずに復旧を選べる。
        for (let step = 0; step < 20; step++) {
          if (
            await button.evaluate((element) =>
              element.classList.contains("is-active")
            )
          )
            break
          await pad(5)
        }
        assert.ok(
          await button.evaluate((element) =>
            element.classList.contains("is-active")
          ),
          "パッドで再保存ボタンを選べない"
        )
        await pad(0)
      } else {
        await button.focus()
        await page.keyboard.press("Enter")
      }
      await page.waitForFunction(() => window.__saveProbe.attempts === 4)
      if (mode === "async") {
        assert.ok(
          await warning
            .getByRole("button", { name: "保存しています…" })
            .isDisabled()
        )
        await warning.locator("button").evaluate((element) => {
          if (!(element instanceof HTMLButtonElement))
            throw new Error("再保存ボタンがない")
          element.click()
          element.click()
        })
        await pad(0)
        await pad(0)
        assert.equal(await page.evaluate(() => window.__saveProbe.attempts), 4)
        assert.equal(
          await page.locator("[data-screen-content]").textContent(),
          screen,
          "保存中のパッドAで背面を操作した"
        )
        await page.evaluate(() => window.__saveProbe.finish!())
      }
      await warning.waitFor({ state: "detached" })
      if (mode === "async") {
        time += 500
        await page.evaluate(
          (time) => (window.__devStudio as StudioRuntime).advance(time),
          time
        )
        assert.ok(
          await page.locator(".listview.bag .is-active").count(),
          "再保存後に開いていたバッグへ選択が戻らない"
        )
      }
      const after = await page.evaluate(() => ({
        state: JSON.stringify(
          (window.__devStudio as StudioRuntime).game!.save()
        ),
        stored: window.__saveProbe.stored,
      }))
      assert.equal(after.state, before, "再保存でゲーム状態が変わる")
      assert.equal(after.stored, before, "最新の状態を保存していない")
      console.log(
        `${width}/${mode}: 失敗表示・再失敗保持・${mode === "async" ? "パッド" : "Enter"}再保存・重複防止・最新状態の保持`
      )
      await page.close()
    }
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
