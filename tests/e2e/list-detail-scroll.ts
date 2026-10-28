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
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 667 },
  ]) {
    const page = await openPage(browser, viewport, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "shop-smithy-craft",
            ...viewport,
            duration: 20000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    let time = 4000
    const advance = async () => {
      time += 500
      await page.evaluate(
        async (time) => window.__devStudio!.advance(time),
        time
      )
    }
    await advance()
    await page.locator(".listview .slot-item.row").first().click()
    await advance()
    const detail = page.locator(".listview .detail")
    assert.ok(
      await detail.evaluate((el) => el.scrollHeight > el.clientHeight),
      "実際の品物説明が欄より長いこと"
    )
    const saved = await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).game!.save()
    )
    const selected = await detail.innerText()
    const rows = page.locator(".listview .rows")
    const listTop = await rows.evaluate((el) => el.scrollTop)
    await page.evaluate(() => {
      const pad = {
        index: 0,
        buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
        axes: [0, 0, 0, 0],
      }
      Object.assign(window, { listDetailTestPad: pad })
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [pad],
      })
    })
    const scroll = async (axis: number) => {
      await page.evaluate((axis) => {
        ;(
          window as unknown as { listDetailTestPad: { axes: number[] } }
        ).listDetailTestPad.axes[3] = axis
      }, axis)
      await advance()
    }
    await scroll(1)
    await scroll(0)
    assert.ok(
      await detail.evaluate((el) => el.scrollTop > 0),
      "右スティックで説明の続きが読めない"
    )
    await page.screenshot({
      path: `/tmp/dnd-list-detail-scroll-${viewport.width}.png`,
    })
    await scroll(-1)
    await scroll(0)
    assert.equal(await detail.evaluate((el) => el.scrollTop), 0)
    await detail.focus()
    for (const key of ["ArrowDown", "PageDown", "Space"]) {
      await page.keyboard.press("Home")
      await page.keyboard.press(key)
      assert.ok(
        await detail.evaluate((el) => el.scrollTop > 0),
        `${key}で説明を下へ読む`
      )
      assert.equal(
        await detail.innerText(),
        selected,
        "本文のキーで選択した品を替えない"
      )
    }
    for (const key of ["ArrowUp", "PageUp", "Shift+Space"]) {
      await page.keyboard.press("End")
      const bottom = await detail.evaluate((el) => el.scrollTop)
      await page.keyboard.press(key)
      assert.ok(
        (await detail.evaluate((el) => el.scrollTop)) < bottom,
        `${key}で説明を上へ読む`
      )
    }
    await page.keyboard.press("Enter")
    await page.keyboard.press("End")
    assert.ok(
      await detail.evaluate((el) => el.scrollTop > 0),
      "Endで末尾を読めない"
    )
    await page.keyboard.press("Home")
    assert.equal(await detail.evaluate((el) => el.scrollTop), 0)
    assert.equal(
      await detail.innerText(),
      selected,
      "説明のスクロールで品物を選び直した"
    )
    assert.equal(
      await rows.evaluate((el) => el.scrollTop),
      listTop,
      "説明のスクロールで品物一覧が動いた"
    )
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      saved
    )
    console.log(
      `${viewport.width}x${viewport.height}: 長い説明を右スティック・Home/Endで読み、選択と保存を保持 OK`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
