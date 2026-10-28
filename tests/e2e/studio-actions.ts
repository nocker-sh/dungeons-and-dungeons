import assert from "node:assert/strict"
import { waitForStudio } from "@/scripts/studio-browser"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"

const browser = await launch()
try {
  for (const width of [390, 1280]) {
    const errors: string[] = []
    const page = await openPage(browser, { width, height: 844 }, errors)
    const config = parseStudioConfig({ width })
    await page.goto(BASE_URL + frameUrl(config))
    await waitForStudio(page)
    assert.equal(await page.evaluate(() => window.__devStudioError), undefined)
    await page.evaluate(() => window.__devStudio!.advance(3000))
    const rejected = await page.evaluate(() => {
      const studio = window.__devStudio!
      const before = studio.inspect()
      studio.click("場面")
      studio.click("隊列")
      return { before, after: studio.inspect() }
    })
    assert.deepEqual(rejected.after.operations, [
      { at: 3000, label: "場面", success: false },
      { at: 3000, label: "隊列", success: false },
    ])
    assert.deepEqual(rejected.after.state, rejected.before.state)
    assert.deepEqual(rejected.after.errors, [
      "操作できません (3000ms): 場面",
      "操作できません (3000ms): 隊列",
    ])

    // 実ゲームの敵選択はdivのrole=buttonとdata-actionを使う。
    const attack = await page.evaluate(async () => {
      const studio = window.__devStudio!
      studio.click("放つ")
      return studio.advance(5000)
    })
    assert.deepEqual(attack.operations.at(-1), {
      at: 3000,
      label: "放つ",
      success: true,
    })
    assert.notDeepEqual(attack.state, rejected.after.state)
    assert.deepEqual(attack.errors, rejected.after.errors)

    // ネイティブbuttonの操作も同じ経路で演出を開始できる。
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "components",
            width,
            actions: [{ at: 1000, label: "カットイン" }],
          })
        )
    )
    await waitForStudio(page)
    assert.equal(await page.evaluate(() => window.__devStudioError), undefined)
    const cutIn = await page.evaluate(() => window.__devStudio!.advance(1600))
    assert.deepEqual(cutIn.operations, [
      { at: 1000, label: "カットイン", success: true },
    ])
    assert.ok(cutIn.text.includes("スキル発動！"))
    assert.deepEqual(cutIn.errors, [])
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`${width}px: 表示専用の名前を拒否し、攻撃とカットインを実行`)
  }
} finally {
  await browser.close()
}
