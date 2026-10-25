import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
import effects from "../src/lib/concept/data/effects.json"
import { contentSource } from "../src/lib/content/game-content"

const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "quick-quests",
            width,
            height: 844,
            duration: 60000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    await page.evaluate(() => {
      if (window.__devStudioError) throw new Error(window.__devStudioError)
    })
    await page.evaluate(
      async (paths) => {
        const modulePath = "/src/lib/game-client/artwork.ts"
        const { loadArtwork } = await import(modulePath)
        await loadArtwork(paths)
      },
      effects.map((effect) => effect.image)
    )
    const before = await page.evaluate(
      async (armor) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const save = JSON.parse(JSON.stringify(runtime.game!.save()))
        for (const member of save.snapshot.members) member.hp = 1
        for (const gear of save.snapshot.gear)
          gear.wear =
            armor.find((entry) => entry.id === gear.good)?.durability ?? 0
        const error = runtime.game!.restore(save)
        if (error) throw error
        await runtime.advance(3500)
        return {
          gold: runtime.game!.state.gold,
          bag: JSON.stringify(runtime.game!.state.bag),
          reached: runtime.game!.state.reached,
          lastLayer: runtime.game!.state.lastLayer,
        }
      },
      contentSource.goods
        .filter((entry) => entry.kind === "armor")
        .map((entry) => ({ id: entry.id, durability: entry.durability }))
    )
    await page.getByRole("button", { name: "街なか", exact: true }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4000)
    )
    await page.getByRole("button", { name: /街の荷箱を守る/ }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4500)
    )
    await page.getByRole("button", { name: "戦う", exact: true }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(9000)
    )
    for (let time = 10500; time <= 57000; time += 1500) {
      if (
        await page.evaluate(
          () =>
            (window.__devStudio as StudioRuntime).game!.state.phase.type ===
            "town"
        )
      ) {
        await page.evaluate(
          (at) => (window.__devStudio as StudioRuntime).advance(at),
          time + 3000
        )
        break
      }
      const guard = page.getByRole("button", { name: "防御", exact: true })
      if (await guard.count()) {
        const box = await guard.boundingBox()
        if (
          box &&
          box.x + box.width / 2 >= 0 &&
          box.x + box.width / 2 <= width &&
          box.y + box.height / 2 > 0 &&
          box.y + box.height / 2 < 844
        )
          await guard.click()
      }
      await page.evaluate(
        (at) => (window.__devStudio as StudioRuntime).advance(at),
        time
      )
    }
    const after = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      return {
        phase: game.state.phase.type,
        gold: game.state.gold,
        bag: JSON.stringify(game.state.bag),
        wipe: game.state.wipe,
        reached: game.state.reached,
        lastLayer: game.state.lastLayer,
        canRetry: game.queries
          .quests(game.state)
          .find((quest) => quest.name === "街の荷箱を守る")?.canFight,
      }
    })
    if (
      after.phase !== "town" ||
      after.gold !== before.gold ||
      after.bag !== before.bag ||
      after.wipe ||
      !after.canRetry ||
      after.reached !== before.reached ||
      after.lastLayer !== before.lastLayer
    )
      throw new Error(`敗北の扱いが違う: ${JSON.stringify(after)}`)
    await page
      .getByRole("status")
      .filter({ hasText: "敗北。報酬はなし" })
      .waitFor({ state: "visible" })
    await page.screenshot({ path: `/tmp/dnd-quick-defeat-${width}.png` })
    console.log(`PASS ${width}: 実UIで敗北・街へ復帰・没収なし・再挑戦可能`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
