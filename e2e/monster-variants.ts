import { assertFoeHpHidden, BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
import { contentSource } from "../src/lib/content/game-content"
import world from "../src/lib/concept/data/world.json"

const variants = [
  "kamokutsu-mud",
  "kemurimaki-fire",
  "yadocup-fire",
  "horopoppo-poison",
  "tsunofood-bone",
  "slime-swordsman",
]
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [390, 1280]) {
    for (const slug of variants) {
      const foe = contentSource.foes.find((entry) => entry.slug === slug)!
      const layer = contentSource.layers.find(
        (entry) => entry.foes.includes(foe.id) || entry.boss === foe.id
      )!
      const station = layer.stations.find((entry) => entry.id === "n15")!
      const foes =
        layer.boss === foe.id
          ? [slug]
          : station.foes!.map(
              (id) => contentSource.foes.find((entry) => entry.id === id)!.slug
            )
      const image = world.find((entry) => entry.id === foe.id)!.image!
      const page = await openPage(browser, { width, height: 844 }, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "battle",
              foes,
              width,
              height: 844,
              duration: 15000,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(4500)
      )
      const view = await page.evaluate(() => {
        const runtime = window.__devStudio as StudioRuntime
        return {
          battle: runtime.game!.queries.battle(runtime.game!.state),
          save: JSON.stringify(runtime.game!.save()),
          errors: runtime.errors,
        }
      })
      if (view.errors.length) throw new Error(view.errors.join("\n"))
      const individual = view.battle?.foes.find((entry) => entry.foe === foe.id)
      if (!individual || individual.maxHp !== foe.hp)
        throw new Error(`${slug}: 能力が違う`)
      const artwork = page.locator(`.foe img[src="${image}"]`)
      await artwork.waitFor({ state: "visible" })
      if (
        !(await artwork.evaluate(
          (element) =>
            (element as HTMLImageElement).complete &&
            (element as HTMLImageElement).naturalWidth > 0
        ))
      )
        throw new Error(`${slug}: 画像未読込`)
      // 敵の名前・HPは戦闘画面に出さない。名前はQueryで個体と結びつける
      if (individual.name !== foe.name) throw new Error(`${slug}: 名前が違う`)
      await assertFoeHpHidden(page, [foe.name])
      await page.screenshot({
        path: `/tmp/dnd-monster-variants-${width}-${slug}.png`,
      })
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== view.save
      )
        throw new Error(`${slug}: 閲覧で保存が変化`)
      console.log(
        `PASS ${width} ${slug}: 専用画像・名前（非表示）・HP・保存保持`
      )
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
