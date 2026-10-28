import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import settings from "@/content/data/settings.json"
import goods from "@/content/data/goods.json"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    const page = await openPage(browser, viewport, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "route",
            duration: 10000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const expected = await page.evaluate(
      async (loot) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const game = runtime.game!
        const saved = game.save()
        if (saved.snapshot.phase.type !== "expedition")
          throw new Error("探索でない")
        const original = saved.snapshot.gear[0]
        if (!original) throw new Error("装備の前提がない")
        const branch = game.queries
          .route(game.state)!
          .stations.find((station) => station.next.length > 1)!
        const picked = ["carrying-picked-1", "carrying-picked-2"]
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            gold: saved.snapshot.gold + loot.gold,
            bag: [
              ...saved.snapshot.bag.filter(
                (stack) =>
                  !loot.goods.some((entry) => entry.good === stack.good)
              ),
              ...loot.goods.map((stack) => ({
                ...stack,
                count:
                  stack.count +
                  saved.snapshot.bag
                    .filter((entry) => entry.good === stack.good)
                    .reduce((sum, entry) => sum + entry.count, 0),
              })),
            ],
            gear: [
              ...saved.snapshot.gear,
              ...picked.map((id) => ({ ...original, id, owner: null })),
            ],
            phase: {
              ...saved.snapshot.phase,
              expedition: {
                ...saved.snapshot.phase.expedition,
                at: branch.id,
                visited: [
                  ...saved.snapshot.phase.expedition.visited,
                  branch.id,
                ],
                loot: { ...loot, weapons: picked },
              },
            },
          },
        })
        if (issue) throw issue
        await runtime.advance(3500)
        return {
          save: JSON.stringify(game.save()),
          balance: game.queries.route(game.state)!.returnBalance,
          keepJunkPercent: game.queries.route(game.state)!.wipeKeepJunkPercent,
        }
      },
      {
        gold: 1234,
        goods: [
          { good: settings.junk, count: 2 },
          { good: settings.rareJunk, count: 3 },
          { good: goods.find((good) => good.slug === "bone")!.id, count: 7 },
        ],
      }
    )
    // 全滅してもガラクタが残る規則のときだけ、残る割合を添える
    const keepJunkText =
      expected.keepJunkPercent > 0
        ? `ガラクタは${expected.keepJunkPercent}%残る（端数切り上げ）`
        : ""
    const label = page.getByRole("status", {
      name: `抱えた物：金貨 1234G・ガラクタ ×2・光るガラクタ ×3・ほかの品 ×7・未装備の拾い物 ×2。帰還後の所持金 ${expected.balance}G。全滅すると戦利品を失う。拾った武器は武器屋で鑑定してから装備できる${keepJunkText ? `。${keepJunkText}` : ""}`,
      exact: true,
    })
    if (!(await label.isVisible())) throw new Error("戦利品が欠ける")
    if (
      !(await label
        .getByText(`帰還後の所持金 ${expected.balance}G`, { exact: true })
        .isVisible())
    )
      throw new Error("手当て前の帰還金額がない")
    if (await label.getByText(/手当て/).count())
      throw new Error("手当てなしに加算額が出る")
    if (
      !(await label
        .getByText("全滅すると戦利品を失う", { exact: true })
        .isVisible())
    )
      throw new Error("全滅時のリスクがない")
    if (
      keepJunkText
        ? !(await label.getByText(keepJunkText, { exact: true }).isVisible())
        : await label.getByText(/^ガラクタは.*残る/).count()
    )
      throw new Error("全滅時に残るガラクタの説明が規則と違う")
    if (
      !(await label
        .getByText("拾った武器は武器屋で鑑定してから装備できる", {
          exact: true,
        })
        .isVisible())
    )
      throw new Error("拾った武器の装備先がない")
    const bounds = await label.boundingBox()
    if (!bounds || bounds.x < 0 || bounds.x + bounds.width > viewport.width)
      throw new Error("戦利品が画面外")
    const entries = label.locator("[data-carried-entry]")
    if ((await entries.count()) !== 5) throw new Error("戦利品の種類が欠ける")
    for (const entry of await entries.all()) {
      const singleLine = await entry.evaluate((node) => {
        const range = document.createRange()
        range.selectNodeContents(node)
        return range.getClientRects().length === 1
      })
      const entryBounds = await entry.boundingBox()
      if (!singleLine) throw new Error("品名と個数が改行で分かれる")
      if (
        !entryBounds ||
        entryBounds.x < bounds.x ||
        entryBounds.x + entryBounds.width > bounds.x + bounds.width
      )
        throw new Error("戦利品の項目が枠をはみ出す")
    }
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== expected.save
    )
      throw new Error("表示で状態が変化")
    await page.screenshot({
      path: `/tmp/dnd-carrying-branch-${viewport.name}.png`,
    })
    const details = await page
      .getByRole("region", { name: "選んだ道の見通し", exact: true })
      .boundingBox()
    if (!details) throw new Error("道の比較欄がない")
    const overlapWidth =
      Math.min(details.x + details.width, bounds.x + bounds.width) -
      Math.max(details.x, bounds.x)
    const overlapHeight =
      Math.min(details.y + details.height, bounds.y + bounds.height) -
      Math.max(details.y, bounds.y)
    if (overlapWidth > 0 && overlapHeight > 0)
      throw new Error(
        `比較欄と戦利品が重なる: ${overlapWidth}×${overlapHeight}`
      )
    const paths = await page.evaluate(() =>
      (window.__devStudio as StudioRuntime)
        .game!.queries.route((window.__devStudio as StudioRuntime).game!.state)!
        .paths.map((path) => ({ id: path.id, last: path.details.at(-1)! }))
    )
    const distance = await page.getByText(/^中ボスまであと/).boundingBox()
    if (!distance) throw new Error("中ボスまでの距離がない")
    for (const choice of await page.locator("[data-route-choice]").all()) {
      const choiceBounds = await choice.boundingBox()
      if (!choiceBounds) throw new Error("分岐の札がない")
      if (
        Math.min(
          distance.x + distance.width,
          choiceBounds.x + choiceBounds.width
        ) > Math.max(distance.x, choiceBounds.x) &&
        Math.min(
          distance.y + distance.height,
          choiceBounds.y + choiceBounds.height
        ) > Math.max(distance.y, choiceBounds.y)
      )
        throw new Error("分岐の札が中ボス距離を隠す")
    }
    for (const path of paths) {
      await page.locator(`[data-route-choice="${path.id}"]`).click()
      const region = page.getByRole("region", {
        name: "選んだ道の見通し",
        exact: true,
      })
      if (!(await region.getByText(path.last, { exact: true }).count()))
        throw new Error("道の末尾の比較内容が欠ける")
      await region.focus()
      await region.press("End")
      if (
        !(await region.evaluate(
          (node) =>
            Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop) < 1
        ))
      )
        throw new Error("比較欄を末尾まで読めない")
    }
    console.log(`${viewport.name}: 全種の戦利品の個数・収まり・保存保持を確認`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
