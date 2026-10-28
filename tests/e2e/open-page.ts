import type { Browser } from "playwright"

/** 見た目の乱数（崩れた形など）を固定する。 */
export const SEED_RANDOM = `(() => { let s = 12345; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } })()`

export async function openPage(
  browser: Browser,
  viewport: { width: number; height: number },
  errors: string[] = []
) {
  const page = await browser.newPage({
    viewport,
    ignoreHTTPSErrors: true,
    deviceScaleFactor: 1,
  })
  await page.addInitScript(SEED_RANDOM)
  page.on("pageerror", (error) => errors.push(`${page.url()} ${error.message}`))
  page.on("console", (message) => {
    if (message.type() === "error")
      errors.push(`${page.url()} ${message.text().slice(0, 200)}`)
  })
  return page
}
