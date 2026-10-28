import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    const page = await openPage(browser, viewport, errors)
    page.setDefaultTimeout(15000)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "stand-find-armor-1",
            duration: 10000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const memberId = await page.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(2500)
      const game = runtime.game!
      const hero = game.state.gear.find(
        (gear) => gear.id === "preview-find-armor"
      )!.owner!
      const maxHp = game.queries.member(game.state, hero)!.maxHp
      const saved = game.save()
      const problem = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          members: saved.snapshot.members.map((member) =>
            member.id === hero ? { ...member, hp: maxHp } : member
          ),
        },
      })
      if (problem) throw new Error(String(problem))
      await runtime.advance(3000)
      return hero
    })
    await page.getByRole("button", { name: "装備", exact: true }).click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(4000)
    })
    await page.locator('[data-row-key="gear:preview-find-armor"]').click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(6000)
    })
    const details = page.getByRole("region", {
      name: "選んだ品の詳細",
      exact: true,
    })
    const text = await details.innerText()
    if (!text.includes("外した後：耐久 64/64 → 0/0"))
      throw new Error(`防具を外す比較が表示されない: ${text}`)
    const hp = text.match(/現在HP（生命力） (\d+)\/(\d+) → (\d+)\/(\d+)/)
    if (
      !hp ||
      Number(hp[1]) !== Number(hp[2]) ||
      Number(hp[1]) - Number(hp[3]) !== 40 ||
      hp[3] !== hp[4]
    )
      throw new Error(`HP減少の比較が一致しない: ${text}`)
    await details.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await page.screenshot({
      path: `/tmp/dnd-armor-remove-${viewport.name}.png`,
    })
    await page.getByRole("button", { name: "外す", exact: true }).click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(7000)
    })
    const actual = await page.evaluate((member) => {
      const game = (window.__devStudio as StudioRuntime).game!
      return game.queries.member(game.state, member)!
    }, memberId)
    if (actual.hp !== Number(hp[3]) || actual.maxHp !== Number(hp[4]))
      throw new Error("実際の装備後HPが比較と違う")
    console.log(`${viewport.name}: 外す前にHP40減少を表示し、操作後と一致`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
