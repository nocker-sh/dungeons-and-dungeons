import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { BASE_URL, VIEWPORTS } from "@/tests/e2e/lib"
import { FIRE, fire } from "@/tests/e2e/fire"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"

/** 画像演出も手番の完了条件に含み、動きを減らしても戦闘が止まらない。 */
const directory = "/tmp/product-test/visual/battle-effects-lifecycle"
await mkdir(directory, { recursive: true })
const browser = await launch()
try {
  for (const viewport of VIEWPORTS) {
    const errors: string[] = []
    const page = await openPage(browser, viewport, errors)
    await page.goto(`${BASE_URL}/previews/battle`)
    await page.locator(FIRE).waitFor()
    const order = await page.locator(".order").getAttribute("aria-label")
    await fire(page)
    await page.waitForFunction(() => {
      const animations = document.getAnimations().filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target
        return (
          target instanceof HTMLElement &&
          target.hasAttribute("data-comic-effect") &&
          target.closest("[data-battle-effect]")
        )
      })
      if (!animations.length) return false
      for (const animation of animations) {
        animation.pause()
        animation.currentTime = 180
      }
      return true
    })
    await page.waitForTimeout(1600)
    assert.equal(await page.locator(".order").getAttribute("aria-label"), order)
    assert.equal(await page.locator(FIRE).count(), 0)
    assert.ok(
      await page
        .locator("[data-battle-effect] img")
        .evaluateAll(
          (images) =>
            images.length > 0 &&
            images.every(
              (image) => (image as HTMLImageElement).naturalWidth > 0
            )
        )
    )
    await page.screenshot({ path: `${directory}/${viewport.name}-paused.png` })
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        const target = (animation.effect as KeyframeEffect | null)?.target
        if (
          target instanceof HTMLElement &&
          target.closest("[data-battle-effect]")
        )
          animation.play()
      }
    })
    await page.waitForFunction(
      (before) =>
        document.querySelector(".order")?.getAttribute("aria-label") !== before,
      order
    )
    await page.locator("[data-battle-effect]").waitFor({ state: "detached" })
    assert.deepEqual(errors, [])

    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto(`${BASE_URL}/previews/battle`)
    await page.locator(FIRE).waitFor()
    const reducedOrder = await page.locator(".order").getAttribute("aria-label")
    await fire(page)
    await page.waitForFunction(() => {
      const animation = document.getAnimations().find((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target
        return (
          target instanceof HTMLElement &&
          target.hasAttribute("data-comic-effect") &&
          target.closest("[data-battle-effect]")
        )
      })
      if (!animation) return false
      animation.pause()
      animation.currentTime = 180
      return true
    })
    assert.equal(
      await page
        .locator("[data-battle-effect] [data-comic-effect]")
        .first()
        .evaluate((element) => getComputedStyle(element).transform),
      "none"
    )
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        const target = (animation.effect as KeyframeEffect | null)?.target
        if (
          target instanceof HTMLElement &&
          target.closest("[data-battle-effect]")
        )
          animation.play()
      }
    })
    await page.waitForFunction(
      (before) =>
        document.querySelector(".order")?.getAttribute("aria-label") !== before,
      reducedOrder
    )
    await page.locator("[data-battle-effect]").waitFor({ state: "detached" })
    assert.deepEqual(errors, [])
    console.log(
      `${viewport.name}: 画像演出の停止・完了待ち・再開・動きを減らす設定 OK`
    )
    await page.close()
  }
} finally {
  await browser.close()
}
