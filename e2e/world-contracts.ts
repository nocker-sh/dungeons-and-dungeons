import assert from "node:assert/strict"
import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
import { PARTY_SLOTS } from "../src/lib/wiz/content/constants"

const nui = "1cda31a8-f190-4c40-8b75-cff10de8d894"
const browser = await launch()
const errors: string[] = []
try {
  for (const width of process.argv[2]
    ? [Number(process.argv[2])]
    : [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.addInitScript(() => {
      let bridge: StudioRuntime | undefined
      Object.defineProperty(window, "__devStudio", {
        configurable: true,
        get: () => bridge,
        set: (runtime: StudioRuntime) => {
          bridge = runtime
          let current: StudioRuntime["game"]
          Object.defineProperty(runtime, "game", {
            configurable: true,
            get: () => current,
            set: (game: StudioRuntime["game"]) => {
              current = game
              const saved = sessionStorage.getItem("world-contract-checkpoint")
              if (saved && game) {
                const failed = game.restore(JSON.parse(saved))
                if (failed) throw failed
              }
            },
          })
        },
      })
    })
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "town-scenes",
            width,
            height: 844,
            duration: 60000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    let time = 4000
    const advance = async (elapsed = 650) => {
      time += elapsed
      await page.evaluate(
        (time) => (window.__devStudio as StudioRuntime).advance(time),
        time
      )
    }
    const state = () =>
      page.evaluate(() => (window.__devStudio as StudioRuntime).game!.state)
    const finish = async (expected?: string) => {
      const scene = page.locator("[data-conversation-id]")
      await scene.waitFor({ state: "visible" })
      if (expected)
        assert.equal(await scene.getAttribute("data-conversation-id"), expected)
      await page.waitForFunction(() =>
        Array.from(
          document.querySelectorAll<HTMLImageElement>(
            "[data-conversation-portraits] img"
          )
        ).every((image) => image.complete && image.naturalWidth > 0)
      )
      for (let index = 0; index < 30 && (await scene.count()); index++) {
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
    const backToTown = async () => {
      const secret = page.locator(".listview.demon-contracts")
      await secret.getByRole("button", { name: /戻る/ }).click()
      await advance(2500)
      await page.getByRole("button", { name: /戻る/ }).click()
      await advance(2500)
    }
    try {
      await advance()
      assert.equal((await state()).party.length, PARTY_SLOTS)
      // 街に入ると、まず街を訪れたときの場面が流れる
      const opening = await page
        .locator("[data-conversation-id]")
        .getAttribute("data-conversation-id")
      assert.ok(
        opening?.startsWith("visit-town-"),
        `街の場面でない: ${opening}`
      )
      await page.screenshot({ path: `/tmp/dnd-world-${width}-opening.png` })
      await finish(opening ?? undefined)
      await page.evaluate(() => {
        const game = (window.__devStudio as StudioRuntime).game!
        const save = game.save()
        const failed = game.restore({
          ...save,
          snapshot: { ...save.snapshot, reached: 1, gold: 500, bag: [] },
        })
        if (failed) throw failed
      })
      await advance()
      await page
        .getByRole("button", { name: "ワールドマップ", exact: true })
        .click()
      await advance(2500)
      await finish("tutorial-first-world-map")
      assert.equal(
        await page
          .getByRole("button", { name: "黄金の森", exact: true })
          .count(),
        0
      )
      await page.getByRole("button", { name: "街道", exact: true }).click()
      await advance()
      await page.getByRole("button", { name: "街道の村", exact: true }).click()
      await advance()
      await page.getByRole("button", { name: "調べる", exact: true }).click()
      await advance()
      await finish("world-village-directions")
      assert.equal(
        await page
          .getByRole("button", { name: "黄金の森", exact: true })
          .count(),
        1
      )
      await page.screenshot({ path: `/tmp/dnd-world-${width}-map.png` })
      assert.equal(
        (await state()).bag.find((entry) => entry.good === "contract-paper-nui")
          ?.count,
        1
      )
      await page.getByRole("button", { name: "街へ戻る", exact: true }).click()
      await advance(2500)
      // 一周が長いので、実際の保存で再起動し60秒の制作タイムラインを二つに分ける。
      await page.evaluate(() => {
        sessionStorage.setItem(
          "world-contract-checkpoint",
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )
      })
      await page.reload()
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      time = 4000
      await advance()
      await page
        .getByRole("button", { name: "冒険者ギルド", exact: true })
        .click()
      await advance(2500)
      await finish("tutorial-first-guild")
      await page
        .getByRole("button", { name: "秘密の部屋", exact: true })
        .click()
      await advance(2500)
      await finish("tutorial-first-secret")
      await page
        .getByRole("button", { name: "新しい出会い", exact: true })
        .click()
      await advance()
      await page.locator(".row", { hasText: "ヌイ" }).click()
      await advance()
      await page.getByRole("button", { name: "召喚する", exact: true }).click()
      await advance()
      await finish("nui-encounter")
      assert.equal(
        (await state()).bag.some(
          (entry) => entry.good === "contract-paper-nui"
        ),
        false
      )
      assert.equal((await state()).gold, 500)
      await page
        .getByRole("button", { name: "もう一度話す", exact: true })
        .click()
      await advance()
      await finish("nui-encounter")
      assert.equal((await state()).gold, 500)
      await backToTown()
      await page
        .getByRole("button", { name: "ワールドマップ", exact: true })
        .click()
      await advance(2500)
      assert.equal(await page.locator("[data-conversation-id]").count(), 0)
      await page
        .getByRole("button", { name: "街道の村", exact: true })
        .last()
        .click()
      await advance()
      await page
        .getByRole("button", { name: "森への小道", exact: true })
        .click()
      await advance()
      await page.getByRole("button", { name: "黄金の森", exact: true }).click()
      await advance()
      await page.getByRole("button", { name: "調べる", exact: true }).click()
      await advance()
      assert.equal(
        (await state()).bag.find((entry) => entry.good === "golden-apple")
          ?.count,
        1
      )
      assert.equal(
        await page
          .getByRole("button", { name: "調べる", exact: true })
          .isDisabled(),
        true
      )
      await page.screenshot({ path: `/tmp/dnd-world-${width}-apple.png` })
      await page.getByRole("button", { name: "街へ戻る", exact: true }).click()
      await advance(2500)
      await page
        .getByRole("button", { name: "冒険者ギルド", exact: true })
        .click()
      await advance(2500)
      assert.equal(await page.locator("[data-conversation-id]").count(), 0)
      await page
        .getByRole("button", { name: "秘密の部屋", exact: true })
        .click()
      await advance(2500)
      await page
        .getByRole("button", { name: "新しい出会い", exact: true })
        .click()
      await advance()
      await page.locator(".row", { hasText: "ヌイ" }).click()
      await advance()
      await page.getByRole("button", { name: "契約する", exact: true }).click()
      await advance()
      const final = await state()
      assert.equal(final.gold, 400)
      assert.ok(final.demons.some((entry) => entry.id === nui))
      assert.equal(
        final.bag.some((entry) => entry.good === "golden-apple"),
        false
      )
      await page.screenshot({ path: `/tmp/dnd-world-${width}-joined.png` })
      console.log(
        `PASS ${width}: 四人の冒頭・初回案内・村の情報・地図移動・契約書召喚・無料再会・金のリンゴ採集・正式加入`
      )
    } catch (error) {
      await page.screenshot({ path: `/tmp/dnd-world-${width}-failed.png` })
      throw error
    }
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
