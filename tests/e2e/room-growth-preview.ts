import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { openPreview } from "@/tests/e2e/open-preview"
import { tap } from "@/tests/e2e/tap"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import { layoutTime } from "@/development/studio/layout-time"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
try {
  const errors: string[] = []
  const preview = await openPage(browser, { width: 390, height: 844 }, errors)
  await openPreview(preview, "room-growth")
  assert.equal(
    await preview
      .getByRole("region", { name: "成長できる仲間", exact: true })
      .textContent(),
    "レベルアップ予定：アルダ"
  )
  await tap(
    preview,
    preview.getByRole("button", { name: "泊まる", exact: true })
  )
  await preview
    .getByRole("region", { name: "アルダのレベルアップ", exact: true })
    .waitFor()
  await preview.close()

  for (const [width, party] of [
    [390, ["hero", "alda", "mort"]],
    [1280, ["hero", "rivet", "husky"]],
  ] as const) {
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({ scene: "room-levelup", width, party: [...party] })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    assert.equal(await page.evaluate(() => window.__devStudioError), undefined)
    const before = await page.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(1500)
      const game = runtime.game!
      const member = game.queries
        .party(game.state)
        .find((entry) => !entry.hero)!
      return {
        member,
        gold: game.state.gold,
        room: game.queries.rooms(game.state).find((entry) => entry.levelUp)!,
      }
    })
    assert.equal(
      await page
        .getByRole("region", { name: "成長できる仲間", exact: true })
        .textContent(),
      `レベルアップ予定：${before.member.name}`
    )
    const after = await page.evaluate(
      async ({ id, at }) => {
        const runtime = window.__devStudio as StudioRuntime
        const state = await runtime.advance(at)
        const game = runtime.game!
        return {
          state,
          member: game.queries.member(game.state, id)!,
          raw: game.state.members.find((entry) => entry.id === id)!,
          gold: game.state.gold,
        }
      },
      { id: before.member.id, at: layoutTime("room-levelup") }
    )
    assert.deepEqual(after.state.errors, [])
    assert.deepEqual(after.state.operations, [
      { at: 2000, label: "泊まる", success: true },
    ])
    assert.equal(after.member.lv, before.member.lv + 1)
    assert.equal(after.gold, before.gold - before.room.price)
    assert.equal(
      await page
        .getByRole("region", {
          name: `${before.room.name}の宿泊条件`,
          exact: true,
        })
        .count(),
      0,
      "宿泊後は退場した料金・条件を読み上げ対象から外す"
    )
    assert.equal(
      await page
        .getByRole("region", {
          name: `${before.member.name}のレベルアップ`,
          exact: true,
        })
        .count(),
      1
    )
    const region = page.getByRole("region", {
      name: `${before.member.name}のレベルアップ`,
      exact: true,
    })
    for (const [label, stat] of [
      ["HP", "maxHp"],
      ["筋力", "str"],
      ["技量", "tec"],
      ["速さ", "spd"],
    ] as const) {
      const row = region.getByRole("group", { name: new RegExp(`^${label} `) })
      assert.equal(
        await row.evaluate((node) => getComputedStyle(node).opacity),
        "1",
        `${label}が登場済み`
      )
      assert.equal(
        await row.locator("b").first().textContent(),
        String(after.raw.stats[stat]),
        `${label}の数え上げが完了している`
      )
    }
    await page.screenshot({ path: `/tmp/dnd-growth-preview-${width}.png` })
    await page.close()
    console.log(
      `${width}px/${before.member.name}: 初期状態を差し替えず、プレビューの宿泊で成長`
    )
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
