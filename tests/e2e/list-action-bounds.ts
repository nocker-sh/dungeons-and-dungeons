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
  for (const [width, height] of [
    [320, 844],
    [390, 844],
    [1280, 844],
    [568, 320],
    [844, 390],
  ]) {
    for (const legacyName of [false, true]) {
      const page = await openPage(browser, { width, height }, errors)
      await page.routeWebSocket("**/*", () => {})
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: legacyName ? "town" : "stand",
              width,
              height,
              duration: 15000,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      const expected = await page.evaluate(async (legacyName) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(3500)
        const game = runtime.game!
        if (legacyName) {
          const saved = game.save()
          const issue = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              hero: { ...saved.snapshot.hero, name: "アカサタナハマヤ" },
            },
          })
          if (issue) throw issue
          const moved = game.send({
            type: "swap-rows",
            a: game.state.party[0],
            b: game.state.party[2],
          })
          if (!Array.isArray(moved)) throw moved
        }
        await runtime.advance(4000)
        const party = game.queries.party(game.state)
        return {
          save: game.save(),
          actor: party[0].id,
          target: party[2].id,
          name: party[2].name,
        }
      }, legacyName)
      if (legacyName) {
        await page.locator(".formation .card .hit").first().click()
        await page.evaluate(async () => window.__devStudio!.advance(4500))
      }
      await page.getByRole("button", { name: "後衛へ", exact: true }).click()
      await page.evaluate(async () => window.__devStudio!.advance(5000))
      await page
        .getByRole("button", { name: expected.name, exact: true })
        .click()
      await page.evaluate(async () => window.__devStudio!.advance(5500))
      const button = page.getByRole("button", {
        name: `${expected.name}と入れ替える`,
        exact: true,
      })
      for (const hover of [false, true]) {
        if (hover) {
          const bounds = (await button.boundingBox())!
          await page.mouse.move(
            Math.min(width - 1, bounds.x + bounds.width - 2),
            bounds.y + bounds.height / 2
          )
        }
        // 登場後の文字の脈動と、ホバー拡大・カーソル追従が重なる各時点を測る。
        for (const offset of [0, 200, 400, 600]) {
          await page.evaluate(
            async (time) => window.__devStudio!.advance(time),
            5500 + (hover ? 1000 : 0) + offset
          )
          const bounds = await button.evaluate((el) => {
            const text = el.querySelector<HTMLElement>(".txt")!
            const letters = [...text.children].map((span) =>
              span.getBoundingClientRect()
            )
            const stroke =
              parseFloat(getComputedStyle(text).webkitTextStrokeWidth) / 2
            return {
              left: Math.min(...letters.map((r) => r.left)) - stroke,
              right: Math.max(...letters.map((r) => r.right)) + stroke,
              bottom: Math.max(...letters.map((r) => r.bottom)) + stroke,
              barTop: el
                .closest(".game")!
                .querySelector(".letterbox")!
                .getBoundingClientRect().top,
              rowsRight: el
                .closest(".listview")!
                .querySelector(".rowsbox")!
                .getBoundingClientRect().right,
              fontSize: parseFloat(getComputedStyle(el).fontSize),
            }
          })
          assert.ok(
            bounds.bottom <= bounds.barTop - 1,
            `${width}/${height}/${expected.name}: 文字が黒帯に隠れる ${JSON.stringify(bounds)}`
          )
          if (width > height) {
            assert.ok(
              bounds.left >= bounds.rowsRight,
              `横画面の操作が一覧に重なる ${JSON.stringify(bounds)}`
            )
            assert.ok(
              bounds.fontSize >= 14,
              `横画面の文字が小さすぎる ${bounds.fontSize}`
            )
          }
          assert.ok(
            bounds.left >= 0 && bounds.right <= width,
            `${width}/${expected.name}/${hover}/${offset}: 文字が画面外 ${JSON.stringify(bounds)}`
          )
        }
      }
      assert.deepEqual(
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).game!.save()
        ),
        expected.save
      )
      await page.screenshot({
        path: `/tmp/dnd-action-bounds-${width}-${height}-${legacyName ? "long" : "normal"}.png`,
      })
      await button.click()
      await page.evaluate(async () => window.__devStudio!.advance(8500))
      const actual = await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      )
      assert.deepEqual(actual.snapshot, {
        ...expected.save.snapshot,
        party: expected.save.snapshot.party.map((id) =>
          id === expected.actor
            ? expected.target
            : id === expected.target
              ? expected.actor
              : id
        ),
      })
      console.log(
        `${width}/${expected.name}: 通常・ホバー・脈動中の文字が画面内、入れ替え成功・他の資産保持 OK`
      )
      await page.close()
    }
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
