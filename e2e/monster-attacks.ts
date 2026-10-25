import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { BASE_URL, VIEWPORTS, launch } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import {
  foeAppearance,
  foeAttackImage,
} from "../src/lib/content/foe-appearance"
import { contentSource } from "../src/lib/content/game-content"

const directory = "node_modules/.cache/studio/monster-attacks"
await mkdir(directory, { recursive: true })
const definition = contentSource.foes.find(
  (entry) => entry.slug === "makigaitsu"
)!
const cases = [
  { seed: 3, name: "粘液まき", skill: "slime-spray" },
  { seed: 4, name: "殻ぶつけ", skill: "shell-bump" },
  { seed: 5, name: "殻の体当たり", skill: undefined },
]
const browser = await launch()
try {
  for (const viewport of VIEWPORTS) {
    for (const action of cases) {
      const page = await browser.newPage({ viewport, ignoreHTTPSErrors: true })
      const config = parseStudioConfig({
        width: viewport.width,
        height: viewport.height,
        foes: ["makigaitsu"],
        seed: action.seed,
        duration: 15000,
        // 3人が防御したあと、敵の手番の攻撃の最中（およそ8400〜10400ms）を見る
        actions: [2500, 5000, 7500].map((at) => ({ at, label: "防御" })),
      })
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      await page.goto(BASE_URL + frameUrl(config))
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      assert.equal(
        await page.evaluate(() => window.__devStudioError),
        undefined
      )
      const inspection = await page.evaluate(() =>
        window.__devStudio!.advance(9200)
      )
      const skill = contentSource.skills.find(
        (entry) => entry.slug === action.skill
      )?.id
      const expected = foeAttackImage(foeAppearance(definition.id), { skill })
      const image = await page.locator(".foe img").getAttribute("src")
      assert.equal(image, expected, `${viewport.name}: ${action.name}の画像`)
      const text = await page.locator("body").innerText()
      assert.ok(
        text.includes(action.name),
        `${viewport.name}: ${action.name}の名前が出ない`
      )
      assert.deepEqual(inspection.errors, [])
      assert.deepEqual(errors, [])
      await page.screenshot({
        path: `${directory}/${viewport.name}-${action.seed}.png`,
      })
      await writeFile(
        `${directory}/${viewport.name}-${action.seed}.json`,
        JSON.stringify(
          { name: action.name, image, expected, inspection },
          null,
          2
        )
      )
      await page.close()
      console.log(`${viewport.name}: ${action.name}の画像・名前 OK`)
    }
  }
} finally {
  await browser.close()
}
