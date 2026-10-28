import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
try {
  for (const [width, height] of [
    [320, 568],
    [844, 390],
  ])
    for (const kind of ["wipe", "ending"] as const) {
      const errors: string[] = []
      const page = await openPage(browser, { width, height }, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: `result-${kind}`,
              width,
              height,
              duration: 15000,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      assert.equal(
        await page.evaluate(() => window.__devStudioError),
        undefined
      )
      let time = 4500
      const advance = async (ms: number) => {
        time += ms
        await page.evaluate((time) => window.__devStudio!.advance(time), time)
      }
      await advance(0)
      const saved = await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      )
      const dialog = page.getByRole("dialog", {
        name: kind === "wipe" ? "全滅の結果" : "踏破の結果",
        exact: true,
      })
      const body = dialog.locator(".result-body")
      const close = dialog.getByRole("button", {
        name: kind === "wipe" ? "街へ" : "まだ潜る",
        exact: true,
      })
      const focused = () => body.evaluate((el) => el === document.activeElement)
      const top = () => body.evaluate((el) => el.scrollTop)
      const max = await body.evaluate((el) => el.scrollHeight - el.clientHeight)
      if (kind === "wipe")
        assert.ok(max > 50, "実際の全滅結果が小さい画面であふれる")
      await close.focus()
      await page.keyboard.press("Tab")
      assert.equal(await focused(), true, "Tabで結果の本文を読みに行ける")
      await page.keyboard.press("Enter")
      assert.equal(await dialog.count(), 1, "本文のEnterで結果を閉じない")
      for (const key of ["ArrowDown", "PageDown", "Space"]) {
        await page.keyboard.press("Home")
        assert.equal(await top(), 0)
        await page.keyboard.press(key)
        if (max > 0) assert.ok((await top()) > 0, `${key}で本文を下へ読む`)
      }
      await page.keyboard.press("End")
      assert.ok(Math.abs((await top()) - max) <= 1)
      if (kind === "wipe") {
        const last = body.getByText(
          "宿でHP（生命力）を回復し、傷んだ防具は鍛冶屋で修理しよう。",
          { exact: true }
        )
        assert.ok(
          await last.evaluate((el) => {
            const b = el.getBoundingClientRect()
            const area = el.closest(".result-body")!.getBoundingClientRect()
            return b.top >= area.top && b.bottom <= area.bottom
          }),
          "回復と修理の案内を最後まで読める"
        )
      }
      await page.screenshot({
        path: `/tmp/dnd-result-scroll-${width}-${kind}.png`,
      })
      for (const key of ["ArrowUp", "PageUp", "Shift+Space"]) {
        await page.keyboard.press("End")
        await page.keyboard.press(key)
        if (max > 0) assert.ok((await top()) < max, `${key}で本文を上へ読む`)
      }
      await page.keyboard.press("Home")
      await page.evaluate(() => {
        const pad = {
          index: 0,
          buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
          axes: [0, 0, 0, 1],
        }
        Object.assign(window, { resultScrollPad: pad })
        Object.defineProperty(navigator, "getGamepads", {
          configurable: true,
          value: () => [pad],
        })
      })
      await advance(600)
      if (max > 0)
        assert.ok((await top()) > 0, "右スティックで結果本文をスクロールできる")
      await page.evaluate(() => {
        ;(
          window as unknown as { resultScrollPad: { axes: number[] } }
        ).resultScrollPad.axes[3] = 0
      })
      await advance(100)
      assert.deepEqual(
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).game!.save()
        ),
        saved
      )
      await page.keyboard.press("Tab")
      assert.equal(
        await close.evaluate((el) => el === document.activeElement),
        true
      )
      await page.keyboard.press("Shift+Tab")
      assert.equal(await focused(), true, "逆向きのTabも本文へ戻る")
      await page.keyboard.press("Shift+Tab")
      assert.equal(
        await close.evaluate((el) => el === document.activeElement),
        true
      )
      await page.keyboard.press("Enter")
      await advance(800)
      assert.equal(await dialog.count(), 0)
      const after = await page.evaluate(() => {
        const game = (window.__devStudio as StudioRuntime).game!
        return { result: game.queries.result(game.state), save: game.save() }
      })
      assert.ok(!after.result)
      for (const key of ["gold", "bag", "gear", "members"] as const)
        assert.deepEqual(after.save.snapshot[key], saved.snapshot[key])
      assert.deepEqual(errors, [])
      console.log(
        `${width}x${height}/${kind}: Tab循環・キーと右スティックで本文を読む・終了・資産保持`
      )
      await page.close()
    }
} finally {
  await browser.close()
}
