import assert from "node:assert/strict"
import { STUDIO_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/development/preview/studio-runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(
      STUDIO_URL +
        frameUrl(
          parseStudioConfig({
            scene: "town",
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
    let time = 4500
    const advance = async (elapsed = 1500) => {
      time += elapsed
      await page.evaluate(
        (time) => (window.__devStudio as StudioRuntime).advance(time),
        time
      )
    }
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4500)
    )
    const before = await page.evaluate(
      () => (window.__devStudio as StudioRuntime).game!.state
    )
    assert.equal(before.contract, "7a09e178-f9cc-40fc-b87b-472250f3dc35")
    const talk = page.getByRole("button", { name: "ロクスと話す", exact: true })
    await talk.click()
    await advance()
    const scene = page.locator('[data-conversation-trigger="talk"]')
    await scene.waitFor({ state: "visible" })
    await page.waitForFunction(() =>
      Array.from(
        document.querySelectorAll<HTMLImageElement>(
          "[data-conversation-portraits] img"
        )
      ).every((image) => image.complete && image.naturalWidth > 0)
    )
    await advance(2500)
    await page.screenshot({ path: `/tmp/dnd-lox-${width}-talk.png` })
    for (let index = 0; index < 18 && (await scene.count()); index++) {
      const decide = page
        .locator('[role="dialog"] [role="group"] button')
        .first()
      if (await decide.isVisible()) await decide.click()
      else
        await page
          .getByRole("button", { name: "会話を進める", exact: true })
          .click()
      await advance()
    }
    assert.equal(await scene.count(), 0, "初回会話が終わらない")
    const afterTalk = await page.evaluate(
      () => (window.__devStudio as StudioRuntime).game!.state
    )
    assert.ok(afterTalk.conversation?.flags?.includes("lox:met"))
    assert.equal(afterTalk.stones, before.stones)
    assert.equal(afterTalk.gold, before.gold)
    await talk.click()
    await advance(2500)
    const next = await page.evaluate(
      () =>
        (window.__devStudio as StudioRuntime).game!.state.conversation?.active
    )
    assert.notEqual(next, "lox-first-partner")
    for (let index = 0; index < 18 && (await scene.count()); index++) {
      const decide = page
        .locator('[role="dialog"] [role="group"] button')
        .first()
      if (await decide.isVisible()) await decide.click()
      else
        await page
          .getByRole("button", { name: "会話を進める", exact: true })
          .click()
      await advance()
    }
    // プレイヤーは戦わない運営役。ロクスと話しても隊列・資産は変わらない
    const savedAfter = await page.evaluate(
      () => (window.__devStudio as StudioRuntime).game!.state
    )
    assert.deepEqual(savedAfter.members, before.members)
    assert.deepEqual(savedAfter.party, before.party)
    assert.deepEqual(savedAfter.gear, before.gear)
    assert.equal(savedAfter.gold, before.gold)
    assert.equal(savedAfter.contract, before.contract)
    assert.equal(
      await page
        .locator(".formation")
        .getByRole("button", { name: /^あなた HP/ })
        .count(),
      0,
      "プレイヤーが隊列に出ている"
    )
    await page.screenshot({ path: `/tmp/dnd-lox-${width}-town.png` })
    console.log(
      `PASS ${width}: 初期ロクス・直接会話・選択肢・次の会話・隊列と資産の保持`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
