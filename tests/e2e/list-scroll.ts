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
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({ scene: "shop-tools", width, duration: 14000 })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const saved = await page.evaluate(
      async (candidate) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(3500)
        const game = runtime.game!
        const initial = game.save()
        const issue = game.restore({
          ...initial,
          snapshot: { ...initial.snapshot, gold: 10000, bag: [] },
        })
        if (issue) throw new Error(String(issue.cause))
        const bought = game.send({ type: "buy", ...candidate })
        if (!Array.isArray(bought)) throw bought
        const purchased = game.state.gear.find(
          (entry) => !initial.snapshot.gear.some((old) => old.id === entry.id)
        )!
        const next = game.save()
        const invalid = game.restore({
          ...next,
          snapshot: {
            ...next.snapshot,
            gear: [
              ...next.snapshot.gear,
              ...Array.from({ length: 150 }, (_, index) => ({
                ...structuredClone(purchased),
                id: `scroll-gear-${index}`,
              })),
            ],
          },
        })
        if (invalid) throw new Error(String(invalid.cause))
        return game.save()
      },
      {
        shop: shops.find((shop) => shop.slug === "armory")!.id,
        good: goods.find((good) => good.slug === "dagger")!.id,
      }
    )
    await page.getByRole("button", { name: "売却", exact: true }).click()
    await page.evaluate(async () => window.__devStudio!.advance(5000))
    const thumb = page.locator(".listview .thumb")
    const track = page.locator(".listview .sbar")
    const rows = page.locator(".listview .rows")
    assert.equal(await page.locator(".listview .row").count(), 151)
    const t = (await thumb.boundingBox())!
    const b = (await track.boundingBox())!
    const travel = b.height - t.height
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2)
    await page.mouse.down()
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2 + travel, {
      steps: 6,
    })
    await page.mouse.up()
    const bottom = await rows.evaluate((el) => ({
      top: el.scrollTop,
      max: el.scrollHeight - el.clientHeight,
    }))
    assert.ok(
      Math.abs(bottom.max - bottom.top) <= 2,
      `つまみを下端まで動かしても末尾に届かない: ${JSON.stringify(bottom)}`
    )
    await page.evaluate(async () => window.__devStudio!.advance(5500))
    const end = (await thumb.boundingBox())!
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      end.x + end.width / 2,
      end.y + end.height / 2 - travel,
      { steps: 6 }
    )
    await page.mouse.up()
    assert.ok(
      (await rows.evaluate((el) => el.scrollTop)) <= 2,
      "上端まで戻れない"
    )
    await page.evaluate(async () => window.__devStudio!.advance(6000))
    const start = (await thumb.boundingBox())!
    await thumb.evaluate((el) =>
      el.addEventListener(
        "pointerdown",
        (event) => {
          el.setAttribute(
            "data-test-pointer",
            String((event as PointerEvent).pointerId)
          )
        },
        { once: true }
      )
    )
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
    await page.mouse.down()
    const pointerId = Number(await thumb.getAttribute("data-test-pointer"))
    await thumb.dispatchEvent("pointermove", {
      pointerId: pointerId + 1,
      clientY: start.y + 100,
      pointerType: "touch",
      bubbles: true,
    })
    assert.ok(
      (await rows.evaluate((el) => el.scrollTop)) <= 2,
      "別の指にドラッグを奪われた"
    )
    await thumb.dispatchEvent("pointercancel", {
      pointerId,
      pointerType: "mouse",
      bubbles: true,
    })
    await page.mouse.move(
      start.x + start.width / 2,
      start.y + start.height / 2 + 50,
      { steps: 3 }
    )
    await page.mouse.up()
    assert.ok(
      (await rows.evaluate((el) => el.scrollTop)) <= 2,
      "取消後もドラッグが続いている"
    )
    // Chromiumのタッチ入力でも、ブラウザのスクロール動作に奪われず下端へ届く。
    const touch = await page.context().newCDPSession(page)
    await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true })
    const point = {
      x: start.x + start.width / 2,
      y: start.y + start.height / 2,
      id: 7,
    }
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point],
    })
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...point, y: point.y + travel }],
    })
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    })
    const touched = await rows.evaluate((el) => ({
      top: el.scrollTop,
      max: el.scrollHeight - el.clientHeight,
    }))
    assert.ok(
      Math.abs(touched.max - touched.top) <= 2,
      `タッチでは末尾に届かない: ${JSON.stringify(touched)}`
    )
    await touch.detach()
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      saved
    )
    console.log(
      `${width}: 151件の一覧の両端・別の指の無視・取消・タッチドラッグ・資産保持 OK`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
