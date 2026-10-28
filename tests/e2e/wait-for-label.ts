import type { Page } from "playwright"
import { labels } from "@/tests/e2e/labels"

export async function waitForLabel(
  page: Page,
  match: (label: string) => boolean,
  timeout = 15_000
) {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    if ((await labels(page)).some(match)) return
    await page.waitForTimeout(200)
  }
  throw new Error("出てこない")
}
