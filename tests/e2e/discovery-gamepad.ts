import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [1280, 800],
  ]) {
    const errors: string[] = []
    const page = await openPage(browser, { width, height }, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "route-discovery",
            width,
            height,
            duration: 30000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    assert.equal(await page.evaluate(() => window.__devStudioError), undefined)
    let time = 3500
    const advance = async (ms = 100) => {
      time += ms
      await page.evaluate((time) => window.__devStudio!.advance(time), time)
    }
    await advance(0)
    const before = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      const discovery = game.queries.route(game.state)!.discovery!
      const choice = discovery.choices.find(
        (choice) => choice.blessings?.length
      )!
      return {
        save: game.save(),
        skill: choice.blessings![0],
        recipients: discovery.recipients,
      }
    })
    const dialog = page.getByRole("dialog", { name: "渓谷の祝福", exact: true })
    await page.evaluate(() => {
      const pad = {
        index: 0,
        buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
        axes: [0, 0, 0, 0],
      }
      Object.assign(window, { discoveryPad: pad })
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [pad],
      })
    })
    const press = async (button: number) => {
      for (const pressed of [true, false]) {
        await page.evaluate(
          ({ button, pressed }) => {
            ;(
              window as unknown as {
                discoveryPad: { buttons: { pressed: boolean }[] }
              }
            ).discoveryPad.buttons[button].pressed = pressed
          },
          { button, pressed }
        )
        await advance()
      }
    }
    const visible = async () => {
      const selected = dialog.locator("button.is-active")
      assert.equal(await selected.count(), 1)
      assert.ok(
        await selected.evaluate((el) => {
          const r = el.getBoundingClientRect()
          const box = el.closest('[role="dialog"]')!.getBoundingClientRect()
          const hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2
          )
          return (
            r.top >= box.top &&
            r.bottom <= box.bottom &&
            !!hit &&
            el.contains(hit)
          )
        }),
        "選択中のボタン全体が見えて押せる"
      )
    }
    const buttons = dialog.locator("button:not(:disabled)")
    const count = await buttons.count()
    assert.ok(count > 2)
    for (const direction of [5, 4])
      for (let i = 0; i < count; i++) {
        await press(direction)
        await visible()
      }
    const scroll = async (axis: number, ms: number) => {
      await page.evaluate((axis) => {
        ;(
          window as unknown as { discoveryPad: { axes: number[] } }
        ).discoveryPad.axes[3] = axis
      }, axis)
      await advance(ms)
    }
    const maxScroll = await dialog.evaluate(
      (el) => el.scrollHeight - el.clientHeight
    )
    await scroll(-1, 1200)
    await scroll(0, 100)
    assert.equal(await dialog.evaluate((el) => el.scrollTop), 0)
    await scroll(1, 250)
    await scroll(0, 100)
    if (maxScroll > 0)
      assert.ok(
        await dialog.evaluate((el) => el.scrollTop > 0),
        "右スティックで説明を読める"
      )
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      before.save
    )
    // R/Lで最初の祝福へ戻して確定。仲間選びはBで取り消せる。
    await press(5)
    await press(4)
    await visible()
    await press(0)
    assert.equal(await dialog.locator("[data-selected-blessing]").count(), 1)
    for (let i = 0; i < before.recipients.length; i++) {
      await press(5)
      await visible()
    }
    await press(1)
    assert.equal(await dialog.locator("[data-selected-blessing]").count(), 0)
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      before.save
    )
    await press(0)
    await visible()
    await press(5)
    await visible()
    await page.screenshot({ path: `/tmp/dnd-discovery-gamepad-${width}.png` })
    await press(0)
    const after = await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).game!.save()
    )
    assert.equal(
      after.snapshot.members.find(
        (member) => member.id === before.recipients[1].id
      )!.blessing,
      before.skill.id
    )
    for (const key of ["gold", "bag", "gear"] as const)
      assert.deepEqual(after.snapshot[key], before.save.snapshot[key])
    assert.equal(await dialog.count(), 0)
    assert.deepEqual(errors, [])
    console.log(
      `${width}x${height}: 選択肢の上下端・右スティック・仲間選びの取消と確定・資産保持`
    )
    await page.close()
  }
} finally {
  await browser.close()
}
