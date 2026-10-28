import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import goods from "@/content/data/goods.json"

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
    const advance = async (ms = 800) => {
      time += ms
      await page.evaluate(
        async (time) => window.__devStudio!.advance(time),
        time
      )
      // advance末尾の実フレームでResizeObserverが届く。次の描画とつまみの80msの移動まで進める。
      time += 200
      await page.evaluate(
        async (time) => window.__devStudio!.advance(time),
        time
      )
    }
    await advance()
    const initial = await page.evaluate(
      (ids) => {
        const game = (window.__devStudio as StudioRuntime).game!
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            bag: ids.map((good) => ({ good, count: 1 })),
            provisions: [],
            gear: saved.snapshot.gear.filter((entry) => entry.owner),
          },
        })
        if (issue) throw issue
        return { save: game.save(), items: game.queries.sellables(game.state) }
      },
      goods
        .filter(
          (good) =>
            good.kind === "item" &&
            !("sellable" in good && good.sellable === false)
        )
        .slice(0, 8)
        .map((good) => good.id)
    )
    assert.ok(initial.items.length >= 6)
    await page.getByRole("button", { name: "売却", exact: true }).click()
    await advance(1500)
    const rows = page.locator(".listview .rows")
    const measure = () =>
      page.locator(".listview").evaluate((el) => {
        const grid = el.querySelector<HTMLElement>(".rows")!
        const track = el.querySelector<HTMLElement>(".sbar")!
        const thumb = el.querySelector<HTMLElement>(".thumb")!
        return {
          client: grid.clientHeight,
          total: grid.scrollHeight,
          top: grid.scrollTop,
          shown: getComputedStyle(track).display !== "none",
          track: track.clientHeight,
          height: thumb.offsetHeight,
          thumbTop: thumb.offsetTop,
        }
      })
    const check = async () => {
      const actual = await measure()
      const max = actual.total - actual.client
      assert.equal(
        actual.shown,
        max > 2,
        `${width}: スクロールバーの表示が内容に合わない ${JSON.stringify(actual)}`
      )
      if (max > 2) {
        const ratio = Math.max(0.14, actual.client / actual.total)
        assert.ok(
          Math.abs(actual.height - actual.track * ratio) <= 2,
          `${width}: つまみの長さが表示範囲と違う ${JSON.stringify(actual)}`
        )
        const top = (actual.top / max) * (actual.track - actual.height)
        assert.ok(
          Math.abs(actual.thumbTop - top) <= 2,
          `${width}: つまみの位置がスクロール位置と違う ${JSON.stringify(actual)}`
        )
      }
      return actual
    }
    // 幅・表示モードを保った高さ変更。スクロール操作なしでも再計測する。
    for (const height of [844, 600, 1000, 600]) {
      await page.setViewportSize({ width, height })
      await advance()
      await check()
    }
    await rows.evaluate((el) => {
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 3
    })
    await advance()
    await check()
    await page.setViewportSize({ width, height: 700 })
    await advance()
    await check()
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      initial.save
    )
    await rows.evaluate((el) => {
      el.scrollTop = 0
    })
    await advance()
    let expected = initial.save
    let sawOverflow = false
    let sawFit = false
    // 売却で内容自体が縮む場合も追従。選択した品だけを一つずつ売る。
    for (const [index, item] of initial.items.entries()) {
      const before = await check()
      sawOverflow ||= before.shown
      sawFit ||= !before.shown
      await page.getByRole("button", { name: item.name, exact: true }).click()
      await advance()
      await page
        .getByRole("button", { name: `${item.price}G で売る`, exact: true })
        .click()
      await advance()
      expected = {
        ...expected,
        snapshot: {
          ...expected.snapshot,
          gold: expected.snapshot.gold + item.price,
          bag: expected.snapshot.bag.filter((entry) => entry.good !== item.id),
        },
      }
      assert.deepEqual(
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).game!.save()
        ),
        expected
      )
      assert.equal(
        await page.locator(".listview .row").count(),
        initial.items.length - index - 1
      )
      assert.equal(
        await page.getByRole("button", { name: /G で売る$/ }).count(),
        0,
        "売り切った品の操作が残る"
      )
      await check()
    }
    assert.equal(sawOverflow, true)
    assert.equal(sawFit, true)
    assert.ok(
      (await page.locator(".listview .rows").innerText()).includes("何もない")
    )
    await page.screenshot({ path: `/tmp/dnd-list-resize-${width}-empty.png` })
    console.log(
      `${width}: 高さ変更・途中位置・内容減少のつまみ追従、全品の売却と所持金・選択解除 OK`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
