import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { BASE_URL, VIEWPORTS, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import world from "../src/lib/concept/data/world.json"
import type { GameState } from "../src/lib/wiz"

// 実際の攻撃を繰り返し、撃破確定→ダメージ到着→戦闘不能画像→退場を確認する。
const directory = "node_modules/.cache/studio/defeated"
await mkdir(directory, { recursive: true })
const browser = await launch()
try {
  for (const viewport of VIEWPORTS) {
    for (const slug of ["kamokutsu", "hiyokobu"]) {
      const enemy = world.find((entry) => entry.slug === slug)!
      const errors: string[] = []
      const page = await openPage(browser, viewport, errors)
      const config = parseStudioConfig({
        foes: [slug],
        width: viewport.width,
        height: viewport.height,
        duration: 30000,
      })
      await page.goto(BASE_URL + frameUrl(config))
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      assert.equal(
        await page.evaluate(() => window.__devStudioError),
        undefined
      )
      await page.evaluate(() => window.__devStudio!.advance(2000))
      let normalBeforeArrival = false
      let defeated = false
      let removed = false
      for (let time = 2040; time <= 28000; time += 40) {
        const frame = await page.evaluate(async (time) => {
          const inspection = await window.__devStudio!.advance(time)
          return {
            state: inspection.state as GameState,
            image: document.querySelector(".foe img")?.getAttribute("src"),
            errors: inspection.errors,
          }
        }, time)
        assert.deepEqual(frame.errors, [])
        if (
          frame.state.phase.type === "expedition" &&
          frame.image === enemy.image
        )
          normalBeforeArrival = true
        if (frame.image === enemy.defeatedImage && !defeated) {
          defeated = true
          await page
            .locator(".foe img")
            .first()
            .evaluate((image) => (image as HTMLImageElement).decode())
          await page.screenshot({
            path: `${directory}/${viewport.name}-${slug}.png`,
          })
        }
        if (defeated && !frame.image) {
          removed = true
          break
        }
        if (!defeated)
          await page.evaluate(() => {
            // 狙っている敵を押すと、選んでいるワザを放つ
            document.querySelector<HTMLElement>('[data-action="放つ"]')?.click()
          })
      }
      assert.ok(normalBeforeArrival, "結果確定だけで画像を先に切り替えない")
      assert.ok(defeated, "倒れた敵の画像を表示する")
      assert.ok(removed, "戦闘不能画像を表示してから退場する")
      assert.deepEqual(errors, [])
      await page.close()
      console.log(`${viewport.name}/${slug}: 戦闘不能画像・切り替え順序 OK`)
    }
  }
} finally {
  await browser.close()
}
