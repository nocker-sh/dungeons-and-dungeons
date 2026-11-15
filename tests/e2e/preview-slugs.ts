import type { Browser } from "playwright"
import { STUDIO_URL } from "@/tests/e2e/lib"

/** /previews の場面の一覧。 */
export async function previewSlugs(browser: Browser) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  await page.goto(`${STUDIO_URL}/previews`)
  const slugs = await page.$$eval("li a", (links) =>
    links.map((link) => link.textContent ?? "")
  )
  await page.close()
  return slugs.filter(Boolean)
}
