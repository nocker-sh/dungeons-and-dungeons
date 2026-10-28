import type { Page } from "playwright"

/** 今の画面で押せる・読める名前（aria-label）。 */
export async function labels(page: Page) {
  return page.$$eval("[aria-label]", (elements) =>
    elements.map((element) => element.getAttribute("aria-label") ?? "")
  )
}
