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
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "route-discovery",
            width,
            height: 844,
            duration: 30000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    let time = 2000
    const advance = async () => {
      time += 1500
      await page.evaluate((time) => window.__devStudio!.advance(time), time)
    }
    const label = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      const saved = game.save()
      if (saved.snapshot.phase.type !== "expedition")
        throw new Error("探索でない")
      const issue = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          gold: 180,
          phase: {
            type: "expedition",
            expedition: {
              ...saved.snapshot.phase.expedition,
              at: "n3",
              visited: ["s", "n8", "n3"],
              pending: { kind: "discovery" },
              loot: { gold: 80, goods: [] },
            },
          },
        },
      })
      if (issue) throw issue
      const choice = game.queries
        .route(game.state)!
        .discovery!.choices.find((entry) => entry.id === "goods")!
      if (choice.cost !== 50) throw new Error("50Gの取引が前提")
      return choice.label
    })
    await advance()
    await page
      .getByRole("dialog", { name: "ククルスの露店", exact: true })
      .getByRole("button")
      .filter({ hasText: label })
      .click()
    await advance()
    const paid = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      return {
        save: game.save(),
        route: game.queries.route(game.state),
        carried: game.queries.carried(game.state),
      }
    })
    assert.equal(paid.save.snapshot.gold, 130)
    assert.equal(paid.carried!.gold, 30)
    assert.equal(paid.route!.carrying.gold, 30)
    assert.equal(paid.route!.bonus, 4)
    assert.equal(paid.route!.returnBalance, 134)
    await page.getByRole("button", { name: "バッグ", exact: true }).click()
    await advance()
    await page.getByRole("button", { name: "持ち帰り", exact: true }).click()
    await advance()
    assert.equal(
      await page
        .locator(".listview.bag")
        .getByText("30G", { exact: true })
        .count(),
      1
    )
    assert.equal(
      await page
        .locator(".listview.bag")
        .getByText("80G", { exact: true })
        .count(),
      0
    )
    await page.keyboard.press("Escape")
    await advance()
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      paid.save
    )
    // 取引後の保存からも残額を読み戻し、結果を閉じて帰還する。
    await page.evaluate((saved) => {
      const game = (window.__devStudio as StudioRuntime).game!
      const issue = game.restore(saved)
      if (issue) throw issue
    }, paid.save)
    await advance()
    await page.getByRole("button", { name: "OK", exact: true }).click()
    await advance()
    const summary = page.getByRole("status", { name: /^抱えた物/ })
    assert.match(await summary.innerText(), /金貨 30G/)
    assert.match(
      await summary.innerText(),
      /帰還後の所持金 134G（手当て \+4G）/
    )
    await page.screenshot({ path: `/tmp/dnd-discovery-gold-${width}.png` })
    await page.getByRole("button", { name: "撤退", exact: true }).click()
    await advance()
    await advance()
    const after = await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).game!.save()
    )
    assert.equal(after.snapshot.phase.type, "town")
    assert.equal(after.snapshot.gold, 134)
    assert.deepEqual(after.snapshot.bag, paid.save.snapshot.bag)
    assert.deepEqual(after.snapshot.gear, paid.save.snapshot.gear)
    console.log(
      `${width}: 80Gの戦利品から50Gの取引、持ち帰り30G・手当て4G、保存復元と実際の帰還残高134G OK`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
