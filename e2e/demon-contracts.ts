import assert from "node:assert/strict"
import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
import conversations from "../src/lib/content/data/conversations.json"

const ids = {
  nui: "1cda31a8-f190-4c40-8b75-cff10de8d894",
  zaza: "22fc495f-8f5e-4239-93dc-03bd6841047b",
  lox: "7a09e178-f9cc-40fc-b87b-472250f3dc35",
  apple: "golden-apple",
  junk: "619ae895-2e95-4f01-ba6b-b78835debae7",
}
const errors: string[] = []
const browser = await launch()
try {
  for (const width of process.argv[2]
    ? [Number(process.argv[2])]
    : [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "guild",
            width,
            height: 844,
            duration: 60000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    await page.evaluate((ids) => {
      if (window.__devStudioError) throw new Error(window.__devStudioError)
      const game = (window.__devStudio as StudioRuntime).game!
      const save = game.save()
      const failed = game.restore({
        ...save,
        snapshot: {
          ...save.snapshot,
          reached: 2,
          gold: 500,
          stones: 3,
          bag: [
            { good: ids.apple, count: 1 },
            { good: "contract-paper-nui", count: 1 },
            { good: "contract-paper-zaza", count: 1 },
            { good: ids.junk, count: 3 },
          ],
          demons: [{ id: ids.lox, lv: 1, exp: 0 }],
          contract: ids.lox,
          conversation: { seen: [], last: null, active: null },
        },
      })
      if (failed) throw failed
    }, ids)
    let time = 4000
    const advance = async (elapsed = 500) => {
      time += elapsed
      await page.evaluate(
        (time) => (window.__devStudio as StudioRuntime).advance(time),
        time
      )
    }
    await advance(0)
    await page.getByRole("button", { name: "秘密の部屋", exact: true }).click()
    await advance(2500)
    assert.equal(
      await page.getByRole("button", { name: "召喚する", exact: true }).count(),
      0
    )
    const choose = async (name: string) => {
      await page.locator(".row", { hasText: name }).click()
      await advance()
    }
    const finish = async () => {
      const scene = page.locator("[data-conversation-id]")
      await scene.waitFor({ state: "visible" })
      const sceneId = await scene.getAttribute("data-conversation-id")
      await page.waitForFunction(() =>
        Array.from(
          document.querySelectorAll<HTMLImageElement>(
            "[data-conversation-portraits] img"
          )
        ).every((image) => image.complete && image.naturalWidth > 0)
      )
      // 1行につき、文字送りの早送りと次へで2回まで押す。選択肢と返事のぶんも足す
      const script = conversations.find((entry) => entry.id === sceneId)
      if (!script) throw new Error(`台本がない: ${sceneId}`)
      const presses =
        2 *
          (script.lines.length +
            Math.max(
              0,
              ...(script.choice?.options.map((option) => option.lines.length) ??
                [])
            )) +
        2
      for (let index = 0; index < presses && (await scene.count()); index++) {
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
      assert.equal(await scene.count(), 0)
    }
    await page
      .getByRole("button", { name: "新しい出会い", exact: true })
      .click()
    await advance()
    await choose("ヌイ")
    await page.screenshot({ path: `/tmp/dnd-contract-${width}-conditions.png` })
    await page.getByRole("button", { name: "召喚する", exact: true }).click()
    await advance(2500)
    await finish()
    await page.getByRole("button", { name: "契約する", exact: true }).click()
    await advance()
    const after = await page.evaluate(
      () => (window.__devStudio as StudioRuntime).game!.state
    )
    assert.equal(after.gold, 400)
    assert.equal(after.stones, 3)
    assert.equal(
      after.bag.find((entry) => entry.good === ids.apple)?.count ?? 0,
      0
    )
    assert.ok(after.demons.some((entry) => entry.id === ids.nui))
    assert.equal(after.contract, ids.lox)
    await choose("ザザ")
    await page.getByRole("button", { name: "召喚する", exact: true }).click()
    await advance(2500)
    await page.waitForFunction(() =>
      Array.from(
        document.querySelectorAll<HTMLImageElement>(
          "[data-conversation-portraits] img"
        )
      ).every((image) => image.complete && image.naturalWidth > 0)
    )
    await advance(1500)
    assert.equal(
      await page.locator("[data-conversation-portraits] img").count(),
      2
    )
    await page.screenshot({ path: `/tmp/dnd-contract-${width}-friends.png` })
    await finish()
    await page.getByRole("button", { name: "契約する", exact: true }).click()
    await advance()
    await page.getByRole("button", { name: "仲間と話す", exact: true }).click()
    await advance()
    await choose("ヌイ")
    await page.getByRole("button", { name: "話す", exact: true }).click()
    await advance(2000)
    await finish()
    const final = await page.evaluate(
      () => (window.__devStudio as StudioRuntime).game!.state
    )
    assert.equal(final.gold, 300)
    assert.equal(final.stones, 3)
    assert.equal(final.demons.length, 3)
    assert.ok(final.conversation!.seen.length >= 3)
    await page.screenshot({ path: `/tmp/dnd-contract-${width}-companions.png` })
    console.log(
      `PASS ${width}: 実UIで出会い・素材と契約料の支払・ヌイとザザの友達場面・仲間との会話`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
