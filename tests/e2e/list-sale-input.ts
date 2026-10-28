import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { tap } from "@/tests/e2e/tap"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import goods from "@/content/data/goods.json"

type TestPad = {
  index: number
  buttons: { pressed: boolean }[]
  axes: number[]
}
const stock = ["potion", "ether", "antidote"].map((slug, index) => ({
  good: goods.find((entry) => entry.slug === slug)!.id,
  count: index === 0 ? 2 : 1,
}))
const browser = await launch()
try {
  for (const width of [320, 390, 1280])
    for (const device of ["keyboard", "gamepad"] as const) {
      const errors: string[] = []
      const page = await openPage(browser, { width, height: 844 }, errors)
      await page.routeWebSocket("**/*", () => {})
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "shop-tools",
              width,
              height: 844,
              duration: 60000,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      let time = 3500
      const advance = async (ms = 1000) => {
        time += ms
        await page.evaluate((time) => window.__devStudio!.advance(time), time)
      }
      await advance()
      const fixture = await page.evaluate((stock) => {
        const game = (window.__devStudio as StudioRuntime).game!
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: { ...saved.snapshot, bag: stock },
        })
        if (issue) throw issue
        const pad: TestPad = {
          index: 0,
          buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
          axes: [0, 0, 0, 0],
        }
        Object.assign(window, { salePad: pad })
        Object.defineProperty(navigator, "getGamepads", {
          configurable: true,
          value: () => [pad],
        })
        return { before: game.save(), rows: game.queries.sellables(game.state) }
      }, stock)
      const input = async (back = false) => {
        if (device === "keyboard") {
          await page.keyboard.press(back ? "Escape" : "Enter")
          await advance()
        } else {
          for (const pressed of [true, false]) {
            await page.evaluate(
              ({ button, pressed }) => {
                ;(window as unknown as { salePad: TestPad }).salePad.buttons[
                  button
                ].pressed = pressed
              },
              { button: back ? 1 : 0, pressed }
            )
            await advance(500)
          }
        }
      }
      const save = () =>
        page.evaluate(() => (window.__devStudio as StudioRuntime).game!.save())
      await tap(page, page.getByRole("button", { name: "売却", exact: true }))
      await advance()
      const select = async (id: string) => {
        const row = fixture.rows.find((entry) => entry.sell.good === id)!
        await tap(
          page,
          page.locator(".row").getByText(row.name, { exact: true })
        )
        await advance()
        await page
          .getByRole("button", { name: `${row.price}G で売る`, exact: true })
          .focus()
        return row
      }
      const removed = await select(stock[1].good)
      await input()
      const sold = await save()
      assert.deepEqual(sold, {
        ...fixture.before,
        snapshot: {
          ...fixture.before.snapshot,
          gold: fixture.before.snapshot.gold + removed.price,
          bag: stock.filter((entry) => entry.good !== stock[1].good),
        },
      })
      assert.equal(
        await page.locator(".listview .row.is-active").count(),
        1,
        "売却後の選択が残りの品へ戻らない"
      )
      // 続けた決定は行を選ぶだけ。閉じたり、別の品を売ったりしない。
      for (let count = 0; count < 2; count++) await input()
      assert.equal(await page.locator(".listview").count(), 1)
      assert.deepEqual(await save(), sold)
      assert.equal(
        await page.locator('.listview .row[aria-pressed="true"]').count(),
        1
      )
      // 同じ品が残っている間は、続けて決定すれば一つずつ売れる。
      const stacked = await select(stock[0].good)
      await input()
      const first = await save()
      assert.equal(
        first.snapshot.bag.find((entry) => entry.good === stock[0].good)!.count,
        1
      )
      assert.equal(
        await page
          .getByRole("button", {
            name: `${stacked.price}G で売る`,
            exact: true,
          })
          .evaluate((el) => el.classList.contains("is-active")),
        true
      )
      await input()
      const second = await save()
      assert.deepEqual(second, {
        ...sold,
        snapshot: {
          ...sold.snapshot,
          gold: sold.snapshot.gold + 2 * stacked.price,
          bag: stock.filter((entry) => entry.good === stock[2].good),
        },
      })
      await input()
      assert.equal(await page.locator(".listview").count(), 1)
      assert.deepEqual(await save(), second)
      await input(true)
      assert.equal(await page.locator(".listview").count(), 0)
      assert.deepEqual(await save(), second)
      assert.deepEqual(errors, [])
      console.log(
        `${width}/${device}: 売切後の行選択・決定連打の資産保持・残数分の連続売却・明示的な終了 OK`
      )
      await page.close()
    }
} finally {
  await browser.close()
}
