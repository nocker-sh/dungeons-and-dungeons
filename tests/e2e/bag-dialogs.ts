import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    for (const kind of ["supplies", "inscription"] as const) {
      const page = await openPage(browser, { width, height: 844 }, errors)
      await page.routeWebSocket("**/*", () => {})
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: kind === "supplies" ? "outskirts-deep" : "smithy-repair",
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
      const advance = async (ms = 1200) => {
        time += ms
        await page.evaluate(
          async (time) => window.__devStudio!.advance(time),
          time
        )
      }
      await advance()
      const saved = await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      )
      await page
        .getByRole("button", {
          name: kind === "supplies" ? "持ち出しを準備" : /ワザの付け替え/,
        })
        .click()
      await advance()
      const label = kind === "supplies" ? "倉庫と手持ち" : "ワザの付け替え"
      const backgroundDialog = page.locator(
        `[data-screen-content] [role="dialog"][aria-label="${label}"]`
      )
      assert.equal(await backgroundDialog.count(), 1)
      await page.getByRole("button", { name: "バッグ", exact: true }).click()
      await advance()
      assert.equal(await page.locator(".listview.bag").count(), 1)
      // 背景のダイアログがTabを奪わず、表示中のバッグへ移れる。
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press("Tab")
        assert.ok(
          await page.evaluate(
            () =>
              document.activeElement instanceof HTMLElement &&
              !document.activeElement.closest("[inert]")
          ),
          `${width}/${kind}: 背景のTab処理に捕まった`
        )
      }
      assert.ok(
        await page.evaluate(
          () => !!document.activeElement?.closest(".listview.bag")
        ),
        `${width}/${kind}: Tabでバッグの中へ移れない`
      )
      await page.keyboard.press("Escape")
      await advance()
      assert.equal(
        await page.locator(".listview.bag").count(),
        0,
        "Escは背景のダイアログではなくバッグを閉じる"
      )
      assert.equal(await backgroundDialog.count(), 1)
      assert.equal(
        await page.getByRole("dialog", { name: label, exact: true }).count(),
        1
      )
      // バッグ側でも持ち出し設定を開く。パッドBは最前面の設定だけを閉じる。
      await page.getByRole("button", { name: "バッグ", exact: true }).click()
      await advance()
      const bagLayer = page
        .locator(".ui-layer")
        .filter({ has: page.locator(".listview.bag") })
      await bagLayer
        .getByRole("button", { name: "持ち出しを準備", exact: true })
        .click()
      await advance()
      const frontDialog = bagLayer.getByRole("dialog", {
        name: "倉庫と手持ち",
        exact: true,
      })
      assert.equal(await frontDialog.count(), 1)
      for (const key of ["Tab", "Shift+Tab"]) {
        await page.keyboard.press(key)
        assert.ok(
          await frontDialog.evaluate((el) =>
            el.contains(document.activeElement)
          )
        )
      }
      await page.evaluate(() => {
        const pad = {
          index: 0,
          buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 1 })),
          axes: [0, 0, 0, 0],
        }
        Object.defineProperty(navigator, "getGamepads", {
          configurable: true,
          value: () => [pad],
        })
      })
      await advance(250)
      await page.evaluate(() =>
        Object.defineProperty(navigator, "getGamepads", {
          configurable: true,
          value: () => [],
        })
      )
      await advance()
      assert.equal(await frontDialog.count(), 0)
      assert.equal(await backgroundDialog.count(), 1)
      assert.equal(await page.locator(".listview.bag").count(), 1)
      await page.keyboard.press("Escape")
      await advance()
      assert.equal(await page.locator(".listview.bag").count(), 0)
      assert.equal(
        await page.getByRole("dialog", { name: label, exact: true }).count(),
        1
      )
      await page.keyboard.press("Escape")
      await advance()
      assert.equal(await page.locator('[role="dialog"]').count(), 0)
      assert.deepEqual(
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).game!.save()
        ),
        saved
      )
      console.log(
        `${width}/${kind}: 背景のTab/Escを停止、バッグと最前面の設定を順に取消、元の設定に復帰・保存保持 OK`
      )
      await page.close()
    }
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
