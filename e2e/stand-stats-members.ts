import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    for (const scene of [
      "stand-find-armor-gald-4",
      "stand-find-armor-mort-4",
      "stand-find-armor-luca-3",
      "stand-find-armor-mimika-3",
    ]) {
      const page = await openPage(browser, viewport, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene,
              duration: 15000,
              width: viewport.width,
              height: viewport.height,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      const expected = await page.evaluate(async () => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(3500)
        const game = runtime.game!
        const owner = game.state.gear.find(
          (entry) => entry.id === "preview-find-armor"
        )!.owner!
        const member = game.queries.member(game.state, owner)!
        return {
          name: member.name,
          role: member.combatStyle,
          exploration: member.exploration,
          save: JSON.stringify(game.save()),
        }
      })
      const stats = page.locator("[data-stand-stats]")
      const text = await stats.innerText()
      if (!text.includes(expected.role) || !text.includes(expected.exploration))
        throw new Error("仲間の効果が欠ける")
      if (
        (await stats.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize)
        )) < 10
      )
        throw new Error("文字が小さい")
      const bounds = await stats.boundingBox()
      if (
        !bounds ||
        bounds.x < 0 ||
        bounds.x + bounds.width > viewport.width ||
        bounds.y < 0 ||
        bounds.y + bounds.height > viewport.height
      )
        throw new Error("仲間情報が画面外")
      await page.screenshot({
        path: `/tmp/dnd-stand-stats-${viewport.name}-${scene}.png`,
      })
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== expected.save
      )
        throw new Error("表示で保存が変わる")
      console.log(
        `${viewport.name}/${expected.name}: 効果・文字サイズ・画面内・保存保持`
      )
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
