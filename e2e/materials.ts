import { mkdir } from "node:fs/promises"
import { BASE_URL, VIEWPORTS, launch, openPage } from "./lib"
import goods from "../src/lib/content/data/goods.json"

const materials = goods.filter((good) => good.kind === "material")
const added = [
  "crystal-claw",
  "statue-shard",
  "rust-fang",
  "venom-petal",
  "spore-pouch",
  "contract-scrap",
  "skill-book",
]
const browser = await launch()
const errors: string[] = []
const evidence = "/tmp/product-test/visual/dnd-materials"
await mkdir(evidence, { recursive: true })
try {
  for (const viewport of VIEWPORTS) {
    const page = await openPage(browser, viewport, errors)
    for (const slug of added) {
      const good = materials.find((material) => material.slug === slug)!
      await page.goto(`${BASE_URL}/dev/materials/${slug}`, {
        waitUntil: "domcontentloaded",
      })
      await page
        .getByRole("heading", { name: good.name, exact: true, level: 1 })
        .waitFor()
      const picture = page.getByRole("img", { name: good.name, exact: true })
      await picture.evaluate(async (image) => {
        await (image as HTMLImageElement).decode()
      })
      if (
        !(await picture.evaluate(
          (image) => (image as HTMLImageElement).naturalWidth > 0
        ))
      )
        throw new Error(`${slug}: 画像未読込`)
      if (
        slug !== "skill-book" &&
        (await page.getByText(/入手方法は未設定/).count())
      )
        throw new Error(`${slug}: 入手元なし`)
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth
        )
      )
        throw new Error(`${slug}: 横はみ出し`)
      await page.screenshot({
        path: `${evidence}/${viewport.name}-${slug}.png`,
        fullPage: true,
      })
    }
    await page.close()
    console.log(`${viewport.name}: 素材7件の個別URL・画像を確認`)
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
