import assert from "node:assert/strict"
import { PNG } from "pngjs"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import { layoutTime } from "@/development/studio/layout-time"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [844, 390],
    [1280, 800],
  ]) {
    const errors: string[] = []
    const page = await openPage(browser, { width, height }, errors)
    await page.goto(
      BASE_URL +
        frameUrl(parseStudioConfig({ scene: "room-levelup", width, height }))
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    assert.equal(await page.evaluate(() => window.__devStudioError), undefined)
    await page.evaluate(
      (time) => window.__devStudio!.advance(time),
      layoutTime("room-levelup")
    )
    const state = await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).game!.save()
    )
    const region = page.getByRole("region", {
      name: "アルダのレベルアップ",
      exact: true,
    })
    const values = await region
      .getByRole("group")
      .filter({ has: page.locator("b") })
      .evaluateAll((rows) =>
        rows.map((row) => {
          const value = row.querySelector("b")!
          const rect = value.getBoundingClientRect()
          return {
            name: row.getAttribute("aria-label"),
            text: value.textContent,
            labelFont: parseFloat(getComputedStyle(row).fontSize),
            rect: rect.toJSON(),
          }
        })
      )
    assert.equal(values.length, 4)
    for (const value of values) {
      assert.ok(
        value.rect.x >= 0 &&
          value.rect.y >= 0 &&
          value.rect.right <= width &&
          value.rect.bottom <= height,
        `${value.name}: 数値が画面内にある`
      )
      assert.ok(value.text?.match(/^\d+$/))
      assert.ok(
        value.labelFont >= 11,
        `${value.name}: ラベルが小さくなりすぎない`
      )
    }
    const shown = PNG.sync.read(
      await page.screenshot({ path: `/tmp/dnd-growth-readable-${width}.png` })
    )
    const figure = region.locator("img")
    const figureBox = await figure.boundingBox()
    assert.ok(figureBox && figureBox.height > 0)
    if (width <= height)
      for (const value of values)
        assert.ok(
          value.rect.bottom <= figureBox.y,
          `${value.name}: 人物の上に数値の領域を確保する`
        )
    const opacity = await figure.evaluate((image) => {
      const previous = image.style.opacity
      image.style.opacity = "0"
      return previous
    })
    const hidden = PNG.sync.read(await page.screenshot())
    await figure.evaluate(
      (image, opacity) => (image.style.opacity = opacity),
      opacity
    )
    // 人物だけを隠しても数値の画素は変わらない。文字の欠けと背景の透けを直接検出する。
    for (const value of values) {
      let changed = 0
      for (
        let y = Math.floor(value.rect.y);
        y < Math.ceil(value.rect.bottom);
        y++
      )
        for (
          let x = Math.floor(value.rect.x);
          x < Math.ceil(value.rect.right);
          x++
        ) {
          const offset = (y * width + x) * 4
          if (
            !shown.data
              .subarray(offset, offset + 4)
              .equals(hidden.data.subarray(offset, offset + 4))
          )
            changed++
        }
      assert.equal(
        changed,
        0,
        `${width}px/${value.name}: 人物画像が数値に重ならない`
      )
    }
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      state
    )
    assert.deepEqual(errors, [])
    await page.close()
    console.log(
      `${width}x${height}: 4能力の数値が人物画像に隠れず、画面内に収まる`
    )
  }
} finally {
  await browser.close()
}
