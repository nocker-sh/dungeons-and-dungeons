import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 760 }, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "outskirts",
            duration: 20000,
            width,
            height: 760,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const fixture = await page.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(4500)
      const game = runtime.game!
      const before = game.save()
      const party = game.queries.party(game.state)
      const armor = game.queries
        .gear(game.state)
        .find(
          (entry) =>
            entry.armor && party.some((member) => member.id === entry.ownerId)
        )!
      if (!armor?.armor) throw new Error("防具がない")
      return {
        before,
        gear: armor.gear,
        maximum: armor.armor.maxDurability,
        member: armor.ownerId,
      }
    })
    if (await page.getByText(/防具が.*着、耐久切れだ/).count())
      throw new Error("満タンで警告")
    const before = await page.evaluate(
      async ({ fixture }) => {
        const runtime = window.__devStudio as StudioRuntime
        const game = runtime.game!
        const issue = game.restore({
          ...fixture.before,
          snapshot: {
            ...fixture.before.snapshot,
            gear: fixture.before.snapshot.gear.map((entry) =>
              entry.id === fixture.gear
                ? { ...entry, wear: fixture.maximum }
                : entry
            ),
          },
        })
        if (issue) throw issue
        await runtime.advance(6500)
        return JSON.stringify(game.save())
      },
      { fixture }
    )
    const warning = page
      .locator(".say")
      .getByText(
        "防具が1着、耐久切れだ。ダメージを防げないぞ。街の鍛冶屋で修理しよう。",
        { exact: true }
      )
    await warning.waitFor({ state: "visible" })
    if (
      (await page
        .getByRole("status", {
          name: "防具が1着、耐久切れだ。ダメージを防げないぞ。街の鍛冶屋で修理しよう。",
          exact: true,
        })
        .count()) !== 1
    )
      throw new Error("読み上げ用の修理案内がない")
    await page.screenshot({ path: `/tmp/dnd-departure-armor-${width}.png` })
    const box = await warning.boundingBox()
    if (
      !box ||
      box.x < 0 ||
      box.y < 0 ||
      box.x + box.width > width ||
      box.y + box.height > 760
    )
      throw new Error(`警告が画面外 ${JSON.stringify(box)}`)
    await page.screenshot({ path: `/tmp/dnd-departure-armor-${width}.png` })
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== before
    )
      throw new Error("閲覧で保存が変わる")
    await page.evaluate(async (fixture) => {
      const runtime = window.__devStudio as StudioRuntime
      const issue = runtime.game!.restore(fixture.before)
      if (issue) throw issue
      await runtime.advance(7500)
    }, fixture)
    if (await warning.count()) throw new Error("満タンへ替えても警告が残る")
    await page.evaluate(async (fixture) => {
      const runtime = window.__devStudio as StudioRuntime
      const issue = runtime.game!.restore({
        ...fixture.before,
        snapshot: {
          ...fixture.before.snapshot,
          gear: fixture.before.snapshot.gear.map((entry) =>
            entry.id === fixture.gear
              ? { ...entry, wear: fixture.maximum }
              : entry
          ),
        },
      })
      if (issue) throw issue
      await runtime.advance(8500)
    }, fixture)
    await warning.waitFor({ state: "visible" })
    await page.getByRole("button", { name: "カチコミ", exact: true }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(12000)
    )
    const phase = await page.evaluate(
      () => (window.__devStudio as StudioRuntime).game!.state.phase.type
    )
    if (phase !== "expedition") throw new Error("耐久切れで出撃を止めた")
    const condition = page.locator(`[data-formation-armor="${fixture.member}"]`)
    await condition.waitFor({ state: "visible" })
    if ((await condition.innerText()).trim() !== "耐久切れ")
      throw new Error("隊列に耐久切れ表示なし")
    const memberButton = condition.locator("../..").locator("button.hit")
    if (!(await memberButton.getAttribute("aria-label"))?.includes("耐久切れ"))
      throw new Error("仲間ボタンの読み上げ名に耐久切れなし")
    const style = await condition.evaluate((element) => ({
      font: parseFloat(getComputedStyle(element).fontSize),
      background: getComputedStyle(element).backgroundColor,
    }))
    if (style.font < 10 || style.background === "rgba(0, 0, 0, 0)")
      throw new Error("耐久切れの可読性不足")
    await page.screenshot({ path: `/tmp/dnd-formation-armor-${width}.png` })
    const after = await page.evaluate(async (fixture) => {
      const runtime = window.__devStudio as StudioRuntime
      const game = runtime.game!
      const save = game.save()
      const issue = game.restore({
        ...save,
        snapshot: {
          ...save.snapshot,
          gear: save.snapshot.gear.map((entry) =>
            entry.id === fixture.gear ? { ...entry, wear: 0 } : entry
          ),
        },
      })
      if (issue) throw issue
      await runtime.advance(14000)
      return JSON.stringify(game.save())
    }, fixture)
    if (
      !(await condition.innerText()).includes(`/${fixture.maximum}`) ||
      (await condition.innerText()).includes("耐久切れ")
    )
      throw new Error("耐久回復で表示が戻らない")
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== after
    )
      throw new Error("隊列閲覧で保存が変わる")
    console.log(
      `${width}: 隊列の耐久切れ札と読み上げ名・満タンへ復帰・閲覧保持・出撃可`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
