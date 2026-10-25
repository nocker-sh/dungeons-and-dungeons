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
            scene: "stand",
            duration: 15000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    await page.evaluate(async () => {
      await window.__devStudio!.advance(2500)
    })
    for (const [index, condition] of ["partial", "immune"].entries()) {
      const expected = await page.evaluate(
        async ({ index, condition }) => {
          const runtime = window.__devStudio as StudioRuntime
          const game = runtime.game!
          const saved = game.save()
          const issue = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              demons: saved.snapshot.demons.map((demon) => ({
                ...demon,
                lv: condition === "immune" ? 20 : 1,
                exp: 0,
              })),
            },
          })
          if (issue) throw issue
          await runtime.advance(3500 + index * 2500)
          const member = game.queries.member(game.state, game.state.party[0]!)!
          if (!member.fusion) throw new Error("合体の効果がない")
          return {
            resist: member.fusion.resist,
            weaponName: member.weapon?.name ?? "なし",
            save: JSON.stringify(game.save()),
          }
        },
        { index, condition }
      )
      const label = page.locator("[data-stand-fusion]")
      await label.waitFor({ state: "visible" })
      await label.scrollIntoViewIfNeeded()
      const text = await label.innerText()
      const fontSize = await label.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize)
      )
      if (fontSize < 11) throw new Error("合体の説明が小さすぎる")
      const weapon = page.locator("[data-stand-weapon]")
      if (!(await weapon.innerText()).includes(expected.weaponName))
        throw new Error("装備中の武器名が違う")
      if (
        (await weapon.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize)
        )) < 11
      )
        throw new Error("武器の説明が小さすぎる")
      const weaponBounds = await weapon.boundingBox()
      if (
        !weaponBounds ||
        weaponBounds.x < 0 ||
        weaponBounds.x + weaponBounds.width > viewport.width ||
        weaponBounds.y < 0 ||
        weaponBounds.y + weaponBounds.height > viewport.height
      )
        throw new Error("武器の説明が画面外")
      for (const entry of expected.resist) {
        const expectedLabel = entry.immune
          ? entry.label
          : `${entry.name}耐性 ${entry.percent}%`
        if (!text.includes(expectedLabel))
          throw new Error("合体耐性の説明が違う")
        if (entry.immune !== (condition === "immune"))
          throw new Error("無効の境界が違う")
      }
      const bounds = await label.boundingBox()
      if (
        !bounds ||
        bounds.x < 0 ||
        bounds.x + bounds.width > viewport.width ||
        bounds.y < 0 ||
        bounds.y + bounds.height > viewport.height
      )
        throw new Error("合体の説明が画面外")
      await page.screenshot({
        path: `/tmp/dnd-stand-fusion-${viewport.name}-${condition}.png`,
      })
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== expected.save
      )
        throw new Error("閲覧で保存が変わる")
      console.log(`${viewport.name}/${condition}: 合体耐性・無効・保存保持`)
    }
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
