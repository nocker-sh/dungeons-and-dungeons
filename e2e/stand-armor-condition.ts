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
            scene: "stand-find-armor-1",
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
    for (const [index, condition] of ["full", "half", "empty"].entries()) {
      const expected = await page.evaluate(
        async ({ index, condition }) => {
          const runtime = window.__devStudio as StudioRuntime
          const game = runtime.game!
          const saved = game.save()
          const gear = saved.snapshot.gear.find(
            (gear) => gear.id === "preview-find-armor"
          )!
          const member = game.queries.member(game.state, gear.owner!)!
          const max = member.armor!.maxDurability
          const wear =
            condition === "full"
              ? 0
              : condition === "empty"
                ? max
                : Math.ceil(max / 2)
          const issue = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              gear: saved.snapshot.gear.map((entry) =>
                entry.id === gear.id ? { ...entry, wear } : entry
              ),
            },
          })
          if (issue) throw issue
          await runtime.advance(3500 + index * 2500)
          const armor = game.queries.member(game.state, gear.owner!)!.armor!
          return {
            name: armor.name,
            durability: armor.durability,
            max: armor.maxDurability,
            gold: armor.gold,
            save: JSON.stringify(game.save()),
          }
        },
        { index, condition }
      )
      const label = page.locator("[data-stand-armor]")
      await label.waitFor({ state: "visible" })
      await label.scrollIntoViewIfNeeded()
      const text = await label.innerText()
      if (
        !text.includes(
          `${expected.name}（耐久 ${expected.durability}/${expected.max}）`
        )
      )
        throw new Error("防具の耐久がQueryと違う")
      if (
        text.includes(`街の鍛冶屋で修理：${expected.gold}G`) !==
        (condition !== "full")
      )
        throw new Error("修理の案内が状態と違う")
      if (
        !(await label.evaluate(
          (element) => parseFloat(getComputedStyle(element).fontSize) >= 11
        ))
      )
        throw new Error("耐久の文字が小さい")
      const advice = label.locator("small")
      if (
        (await label.locator("[data-stand-armor-broken]").count()) !==
        (condition === "empty" ? 1 : 0)
      )
        throw new Error("耐久切れの案内が状態と違う")
      if (
        (await advice.count()) &&
        !(await advice.evaluate(
          (element) => parseFloat(getComputedStyle(element).fontSize) >= 10
        ))
      )
        throw new Error("修理案内が小さい")
      const bounds = await label.boundingBox()
      if (
        !bounds ||
        bounds.x < 0 ||
        bounds.x + bounds.width > viewport.width ||
        bounds.y < 0 ||
        bounds.y + bounds.height > viewport.height
      )
        throw new Error("耐久の案内が画面外")
      await page.screenshot({
        path: `/tmp/dnd-stand-armor-${viewport.name}-${condition}.png`,
      })
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== expected.save
      )
        throw new Error("閲覧で保存が変わる")
      console.log(
        `${viewport.name}/${condition}: 防具の耐久・修理案内・保存保持`
      )
    }
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
