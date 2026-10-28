import type { Page } from "playwright"
import { BASE_URL } from "@/tests/e2e/lib"

/** 場面を開いて落ち着かせる（入りの演出は早送り、繰り返しの動きは止める）。 */
export async function openPreview(page: Page, slug: string, still = true) {
  await page.goto(`${BASE_URL}/previews/${slug}${still ? "?still" : ""}`)
  await page.waitForTimeout(1900)
  if (still)
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        if (animation.effect?.getTiming().iterations === Infinity) {
          animation.pause()
          animation.currentTime = 0
        } else animation.finish()
      }
    })
}
