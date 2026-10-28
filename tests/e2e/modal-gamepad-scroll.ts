import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import goods from "@/content/data/goods.json"
import shops from "@/content/data/shops.json"

const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    for (const kind of ["inscription", "supplies"] as const) {
      const page = await openPage(browser, { width, height: 844 }, errors)
      await page.routeWebSocket("**/*", () => {})
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: kind === "inscription" ? "smithy-repair" : "bag",
              width,
              height: 844,
              duration: 60000,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      const saved = await page.evaluate(
        async ({ kind, items, sword, shop }) => {
          const runtime = window.__devStudio as StudioRuntime
          await runtime.advance(3500)
          const game = runtime.game!
          const save = game.save()
          const issue = game.restore({
            ...save,
            snapshot: {
              ...save.snapshot,
              gold: 100000,
              bag: items.map((good) => ({ good, count: 3 })),
              provisions: [],
            },
          })
          if (issue) throw issue
          if (kind === "inscription") {
            for (let i = 0; i < 8; i++) {
              const bought = game.send({ type: "buy", shop, good: sword })
              if (!Array.isArray(bought)) throw bought
            }
          }
          await runtime.advance(4000)
          const pad = {
            index: 0,
            buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
            axes: [0, 0, 0, 0],
          }
          Object.assign(window, { modalScrollTestPad: pad })
          Object.defineProperty(navigator, "getGamepads", {
            configurable: true,
            value: () => [pad],
          })
          return game.save()
        },
        {
          kind,
          items: goods
            .filter((good) => good.kind === "item")
            .map((good) => good.id),
          sword: goods.find((good) => good.slug === "sword")!.id,
          shop: shops.find((shop) => shop.slug === "armory")!.id,
        }
      )
      await page
        .getByRole("button", {
          name: kind === "inscription" ? /ワザの付け替え/ : "持ち出しを準備",
        })
        .click()
      const dialog = page.getByRole("dialog", {
        name: kind === "inscription" ? "ワザの付け替え" : "倉庫と手持ち",
        exact: true,
      })
      await dialog.waitFor()
      let time = 4500
      const input = async (
        button: number | null,
        pressed: boolean,
        axis = 0
      ) => {
        await page.evaluate(
          ({ button, pressed, axis }) => {
            const pad = (
              window as unknown as {
                modalScrollTestPad: {
                  buttons: { pressed: boolean }[]
                  axes: number[]
                }
              }
            ).modalScrollTestPad
            if (button !== null) pad.buttons[button]!.pressed = pressed
            pad.axes[3] = axis
          },
          { button, pressed, axis }
        )
        time += 250
        await page.evaluate(
          async (time) => window.__devStudio!.advance(time),
          time
        )
      }
      await input(null, false)
      const count = await dialog
        .locator("button:not(:disabled)")
        .evaluateAll((buttons) => {
          for (const [index, button] of buttons.entries()) {
            button.setAttribute("data-scroll-test-index", String(index))
          }
          return buttons.length
        })
      assert.ok(count > 5)
      const selected = () => dialog.locator("button.is-active")
      for (const direction of [13, 12]) {
        const destination = direction === 13 ? count - 1 : 0
        let reached = false
        const visited: number[] = []
        for (let step = 0; step < count + 2; step++) {
          await input(direction, true)
          await input(direction, false)
          const visible = await selected().evaluate((button) => {
            const area = button.closest('[aria-modal="true"]')!
            const b = button.getBoundingClientRect()
            const a = area.getBoundingClientRect()
            const hit = document.elementFromPoint(
              b.x + b.width / 2,
              b.y + b.height / 2
            )
            return {
              index: Number(button.getAttribute("data-scroll-test-index")),
              visible:
                b.top >= a.top - 1 &&
                b.bottom <= a.bottom + 1 &&
                !!hit &&
                button.contains(hit),
              top: b.top,
              bottom: b.bottom,
              areaTop: a.top,
              areaBottom: a.bottom,
            }
          })
          visited.push(visible.index)
          assert.ok(
            visible.visible,
            `${width}/${kind}: 選択先が隠れる ${JSON.stringify(visible)}`
          )
          if (visible.index === destination) {
            reached = true
            break
          }
        }
        assert.ok(
          reached,
          `${kind}: 十字キーで一覧の端に届かない ${JSON.stringify({ direction, count, visited })}`
        )
      }
      const before = await dialog.evaluate((el) => el.scrollTop)
      const behind = await page
        .locator(".listview .rows, .listview .detail")
        .evaluateAll((els) => els.map((el) => el.scrollTop))
      await input(null, false, 1)
      await input(null, false)
      assert.ok(
        (await dialog.evaluate((el) => el.scrollTop)) > before,
        `${kind}: 右スティックでスクロールできない`
      )
      assert.deepEqual(
        await page
          .locator(".listview .rows, .listview .detail")
          .evaluateAll((els) => els.map((el) => el.scrollTop)),
        behind
      )
      await page.screenshot({
        path: `/tmp/dnd-modal-scroll-${kind}-${width}.png`,
      })
      const pointerTarget = await dialog
        .locator("button:not(:disabled):not(.is-active)")
        .evaluateAll((buttons) => {
          for (const button of buttons) {
            const b = button.getBoundingClientRect()
            const x = b.x + b.width / 2
            const y = b.y + b.height / 2
            const hit = document.elementFromPoint(x, y)
            if (hit && button.contains(hit))
              return {
                x,
                y,
                index: button.getAttribute("data-scroll-test-index"),
              }
          }
          return null
        })
      assert.ok(pointerTarget, "マウスで選び直せるボタンがない")
      await page.mouse.move(pointerTarget.x, pointerTarget.y)
      assert.equal(
        await selected().getAttribute("data-scroll-test-index"),
        pointerTarget.index
      )
      await input(1, true)
      assert.equal(await dialog.count(), 0)
      assert.deepEqual(
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).game!.save()
        ),
        saved
      )
      console.log(
        `${width}/${kind}: 十字キーで上下端・選択先の可視性・右スティック・背面停止・保存保持 OK`
      )
      await page.close()
    }
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
