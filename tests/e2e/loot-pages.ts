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
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "route-loot-rare",
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
      const game = runtime.game!
      const phase = game.state.phase
      if (
        phase.type !== "expedition" ||
        phase.expedition.pending?.kind !== "loot"
      )
        throw new Error("戦利品の前提がない")
      const pending = phase.expedition.pending
      const names = pending.goods.map(
        (entry) => `${game.queries.good(entry.good)!.name} ×${entry.count}`
      )
      for (const id of pending.weapons ?? []) {
        const gear = game.queries
          .gear(game.state)
          .find((entry) => entry.gear === id)!
        names.push(`${gear.rarity ? `${gear.rarity} ` : ""}${gear.name} ×1`)
      }
      names.push(`金貨 +${pending.gold}`)
      if (pending.stones) names.push(`召喚石 +${pending.stones}`)
      if (names.length <= 3) throw new Error("複数ページの前提がない")
      return { names, save: JSON.stringify(game.save()) }
    })
    const seen = new Set<string>()
    let index = 0
    while (true) {
      for (const label of await page
        .locator("button.slot-item")
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute("aria-label")!)
        ))
        seen.add(label)
      await page.screenshot({
        path: `/tmp/dnd-loot-pages-${viewport.name}-${index + 1}.png`,
      })
      const next = page.getByRole("button", { name: "次の戦利品", exact: true })
      if (await next.isDisabled()) break
      await next.focus()
      await page.keyboard.press("Enter")
      await page.evaluate(async () => {
        await (window.__devStudio as StudioRuntime).advance(4500)
      })
      index++
    }
    for (const name of expected.names)
      if (!seen.has(name)) throw new Error(`表示されない戦利品：${name}`)
    const last = page.locator("button.slot-item").first()
    await last.click()
    await page.evaluate(async () => {
      await (window.__devStudio as StudioRuntime).advance(5000)
    })
    const dialog = page.getByRole("dialog")
    await dialog.waitFor()
    await dialog.getByRole("button").click()
    await page.evaluate(async () => {
      await (window.__devStudio as StudioRuntime).advance(5500)
    })
    await dialog.waitFor({ state: "detached" })
    while (
      !(await page
        .getByRole("button", { name: "前の戦利品", exact: true })
        .isDisabled())
    ) {
      await page
        .getByRole("button", { name: "前の戦利品", exact: true })
        .click()
      await page.evaluate(async () => {
        await (window.__devStudio as StudioRuntime).advance(6000)
      })
    }
    const pager = page.getByLabel("戦利品のページ", { exact: true })
    const bounds = await pager.boundingBox()
    if (
      !bounds ||
      bounds.x < 0 ||
      bounds.x + bounds.width > viewport.width ||
      bounds.y + bounds.height > viewport.height
    )
      throw new Error("ページ操作が画面外")
    const save = await page.evaluate(() =>
      JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
    )
    if (save !== expected.save)
      throw new Error("ページ切替や詳細で保存状態が変化")
    await page.getByRole("button", { name: "OK", exact: true }).click()
    await page.evaluate(async () => {
      await (window.__devStudio as StudioRuntime).advance(7000)
    })
    for (let attempts = 0; attempts < 30; attempts++) {
      const pending = await page.evaluate(() => {
        const phase = (window.__devStudio as StudioRuntime).game!.state.phase
        return phase.type === "expedition" && !!phase.expedition.pending
      })
      if (!pending) break
      const conversation = page.getByRole("button", {
        name: "会話を進める",
        exact: true,
      })
      if (await conversation.isVisible()) await conversation.click()
      await page.waitForTimeout(250)
      await page.evaluate(
        async (time) => {
          await (window.__devStudio as StudioRuntime).advance(time)
        },
        7500 + attempts * 200
      )
    }
    const acknowledged = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      const phase = game.state.phase
      return {
        ready:
          phase.type === "expedition" &&
          phase.expedition.pending === null &&
          !game.state.conversation?.active,
        save: JSON.stringify(game.save()),
      }
    })
    if (!acknowledged.ready) throw new Error("OK後に探索へ戻らない")
    const before = JSON.parse(expected.save).snapshot
    const after = JSON.parse(acknowledged.save).snapshot
    for (const field of ["gold", "bag", "gear", "stones"]) {
      if (JSON.stringify(before[field]) !== JSON.stringify(after[field]))
        throw new Error(`OK後に報酬が変化：${field}`)
    }
    console.log(
      `${viewport.name}: 全${expected.names.length}品・ページ・詳細・OK後の探索復帰と報酬保持`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
