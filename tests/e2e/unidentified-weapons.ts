import assert from "node:assert/strict"
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
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "shop-armory-junk",
            width,
            height: 844,
            duration: 30000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const original = await page.evaluate(async () => {
      if (window.__devStudioError) throw new Error(window.__devStudioError)
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(3500)
      const game = runtime.game!
      const save = game.save()
      // 店の鑑定を直接検証する保存。ドロップからの生成と帰還はエンジンの戦闘テストで確認。
      const good = game.queries.good("43e8c836-8d6c-47f5-bd33-e8a1e6aabc67")!
      const weapon = {
        good: good.id,
        plus: 0,
        progress: 0,
        wear: 0,
        weapon: {
          rarity: "N" as const,
          extraPower: 0,
          skills: [...good.skills!],
        },
      }
      const found = {
        ...weapon,
        id: "recovered-weapon",
        owner: null,
        plus: 1,
        unidentified: true,
      }
      const failed = game.restore({
        ...save,
        snapshot: {
          ...save.snapshot,
          gear: [...save.snapshot.gear, found],
          bag: [],
        },
      })
      if (failed)
        throw new Error(
          JSON.stringify({
            found,
            problems: game.queries.problems({
              ...save.snapshot,
              gear: [...save.snapshot.gear, found],
              bag: [],
            }),
          })
        )
      return {
        found,
        gold: game.state.gold,
        entry: game.queries
          .gear(game.state)
          .find((entry) => entry.gear === found.id)!,
      }
    })
    assert.match(original.entry.name, /^だれかの/)
    await page.getByRole("button", { name: "鑑定", exact: true }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4200)
    )
    await page.locator(".row", { hasText: original.entry.name }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4800)
    )
    const details = page.getByRole("region", {
      name: "選んだ品の詳細",
      exact: true,
    })
    assert.match(await details.innerText(), /未鑑定/)
    assert.ok(!(await details.innerText()).includes("攻撃力"))
    await page.screenshot({ path: `/tmp/dnd-unidentified-${width}-before.png` })
    await page.getByRole("button", { name: "鑑定する", exact: true }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(10000)
    )
    const result = page.getByRole("dialog", { name: "鑑定の結果", exact: true })
    await result.waitFor({ state: "visible" })
    const actual = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      return {
        gear: game.state.gear.find((entry) => entry.id === "recovered-weapon"),
        entry: game.queries
          .gear(game.state)
          .find((entry) => entry.gear === "recovered-weapon")!,
        gold: game.state.gold,
        bag: game.state.bag,
      }
    })
    assert.deepEqual(actual.gear, { ...original.found, unidentified: false })
    assert.equal(actual.gold, original.gold)
    assert.deepEqual(actual.bag, [])
    assert.ok((await result.innerText()).includes(actual.entry.name))
    assert.ok((await result.innerText()).includes("攻撃力"))
    await page.screenshot({ path: `/tmp/dnd-unidentified-${width}-after.png` })
    console.log(
      `PASS ${width}: 未鑑定の表示・武器屋の鑑定・元の強化とワザの保持`
    )
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "route-loot-rare",
            width,
            height: 844,
            duration: 15000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const dropped = await page.evaluate(async () => {
      if (window.__devStudioError) throw new Error(window.__devStudioError)
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(3500)
      const game = runtime.game!
      const save = game.save()
      const failed = game.restore({
        ...save,
        snapshot: {
          ...save.snapshot,
          gear: save.snapshot.gear.map((entry) =>
            entry.id === "preview-drop"
              ? { ...entry, unidentified: true, plus: 1 }
              : entry
          ),
        },
      })
      if (failed) throw failed
      return game.queries
        .gear(game.state)
        .find((entry) => entry.gear === "preview-drop")!
    })
    await page
      .getByRole("button", { name: `${dropped.name} ×1`, exact: true })
      .click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4000)
    )
    const loot = page.getByRole("dialog", {
      name: `${dropped.name}の詳細`,
      exact: true,
    })
    const text = await loot.innerText()
    assert.ok(text.includes("未鑑定"))
    assert.ok(text.includes("武器屋で鑑定"))
    assert.ok(!text.includes("攻撃力"))
    assert.ok(!text.includes("SR"))
    await page.screenshot({ path: `/tmp/dnd-unidentified-${width}-loot.png` })
    console.log(`PASS ${width}: ダンジョンの戦利品でも正体・強化値・ワザを隠す`)
    await page.close()
  }
  assert.deepEqual(errors, [])
} catch (error) {
  console.error(errors)
  throw error
} finally {
  await browser.close()
}
