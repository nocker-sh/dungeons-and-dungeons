import assert from "node:assert/strict"
import { STUDIO_URL, VIEWPORTS } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"

const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of VIEWPORTS) {
    const page = await openPage(browser, viewport, errors)
    await page.goto(`${STUDIO_URL}/view?catalog=1`)
    const catalogText = await page
      .locator('pre[aria-label="プレビューの指定一覧"]')
      .textContent()
    const catalog = JSON.parse(catalogText!)
    assert.equal(catalog.members.length, 15)
    for (const slug of ["luca", "gald", "tsumugi", "rivet"])
      assert(
        !catalog.members.some(
          (member: { slug: string }) => member.slug === slug
        )
      )
    assert(
      catalog.members.some((member: { slug: string }) => member.slug === "rio")
    )
    for (const category of ["characters", "weapons", "conversations"]) {
      console.log(`${viewport.name}: ${category} を開く`)
      await page.goto(`${STUDIO_URL}/${category}`)
      if (errors.length) throw new Error(errors.join("\n"))
      if (viewport.name === "phone")
        await page.locator('[data-sidebar="trigger"]').click()
      const entries = page.locator('[aria-label="項目"]')
      await entries.first().waitFor()
      const titles = await entries
        .locator("button[title]")
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute("title"))
        )
      assert(titles.length > 0, category)
      for (const title of titles)
        assert(
          ![
            "ルカ",
            "ガルド",
            "ツムギ",
            "リベット",
            "縫い代の身体",
            "借り火の炉心",
          ].some((name) => title?.includes(name)),
          `${category}: ${title}`
        )
      if (category === "characters") assert(titles.includes("リオ"))
      if (category === "weapons") assert(titles.includes("継鋼の剣盾"))
    }
    await page.close()
    console.log(`${viewport.name}: 現役14人・装備・会話の実画面 PASS`)
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
