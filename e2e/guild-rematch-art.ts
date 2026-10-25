import world from "../src/lib/concept/data/world.json"
import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    const page = await openPage(browser, viewport, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "post-clear-guild",
            duration: 15000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const expected = await page.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(3500)
      return {
        quests: runtime
          .game!.queries.quests(runtime.game!.state)
          .map((quest) => ({
            name: quest.name,
            foe: quest.foe,
            rematch: !!quest.requiresCleared,
            encounter: !!quest.encounter,
            locations: quest.locations,
          })),
        save: JSON.stringify(runtime.game!.save()),
      }
    })
    if (expected.quests.filter((quest) => quest.rematch).length !== 5)
      throw new Error("再挑戦5件がない")
    await page.getByRole("button", { name: "クエスト", exact: true }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4500)
    )
    for (const [index, tab] of ["依頼", "再挑戦"].entries()) {
      await page.getByRole("button", { name: tab, exact: true }).click()
      await page.evaluate(
        (time) => (window.__devStudio as StudioRuntime).advance(time),
        5500 + index * 2000
      )
      // 街なか・街の外の単発戦闘は別の札にあり、出現層を持たないので対象外
      for (const quest of expected.quests.filter(
        (quest) => !quest.encounter && quest.rematch === (tab === "再挑戦")
      )) {
        const source = world.find((entry) => entry.id === quest.foe)?.image
        if (!source) throw new Error("ボスの既存画像がない")
        const row = page.getByRole("button", { name: quest.name, exact: true })
        const picture = row.locator("img")
        await picture.waitFor()
        if ((await picture.getAttribute("src")) !== source)
          throw new Error("依頼の対象と画像が違う")
        if (
          !(await picture.evaluate(
            (element) =>
              (element as HTMLImageElement).complete &&
              (element as HTMLImageElement).naturalWidth > 0
          ))
        )
          throw new Error("対象画像を読み込めない")
        await row.click()
        const detail = page.getByRole("region", {
          name: "選んだ品の詳細",
          exact: true,
        })
        if (!quest.locations.length)
          throw new Error("踏破後の依頼の出現層がない")
        const locationText = `対象の出現層：${quest.locations.map((layer) => `${layer.no}層・${layer.name}`).join(" ／ ")}`
        if (!(await detail.innerText()).includes(locationText))
          throw new Error("対象の出現層が詳細にない")
        if ((await detail.locator("img").getAttribute("src")) !== source)
          throw new Error("詳細の対象画像が違う")
      }
      await page.evaluate(
        (time) => (window.__devStudio as StudioRuntime).advance(time),
        6500 + index * 2000
      )
      await page.screenshot({
        path: `/tmp/dnd-guild-quest-locations-${viewport.name}-${index}.png`,
      })
    }
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== expected.save
    )
      throw new Error("画像の閲覧で保存が変わる")
    console.log(`${viewport.name}: 通常と再挑戦の対象画像・詳細画像・保存保持`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
