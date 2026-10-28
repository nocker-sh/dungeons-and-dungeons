import { goodImage } from "@/concept/goods-art"
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
            scene: "bag",
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
      async (goods) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const game = runtime.game!
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            bag: goods.map((good) => ({ good: good.id, count: 3 })),
            provisions: [],
          },
        })
        if (issue) throw issue
        await runtime.advance(3000)
        return {
          save: JSON.stringify(game.save()),
          items: game.queries.supplies(game.state).items,
        }
      },
      goods.filter((good) =>
        ["potion", "ether", "revival-incense", "antidote"].includes(good.slug)
      )
    )
    await page
      .getByRole("button", { name: "持ち出しを準備", exact: true })
      .click()
    const dialog = page.getByRole("dialog", {
      name: "倉庫と手持ち",
      exact: true,
    })
    await dialog.waitFor()
    const text = await dialog.innerText()
    for (const item of expected.items) {
      const art = dialog.locator(`[data-supply-art="${item.id}"]`)
      const image = goodImage(item.id)
      if (image) {
        const rendered = art.locator("img")
        if ((await rendered.getAttribute("src")) !== image)
          throw new Error(`違う道具の画像: ${item.name}`)
        await rendered.evaluate(async (node) => {
          await (node as HTMLImageElement).decode()
        })
        if (
          !(await rendered.evaluate(
            (node) => (node as HTMLImageElement).naturalWidth > 0
          ))
        )
          throw new Error("画像が読み込めない")
      } else if ((await art.locator("svg").count()) !== 1)
        throw new Error("代替アイコンがない")
      const artBounds = await art.boundingBox()
      if (
        !artBounds ||
        artBounds.width !== 32 ||
        artBounds.height !== 32 ||
        artBounds.x < 0 ||
        artBounds.x + artBounds.width > viewport.width
      )
        throw new Error("道具の絵が画面外")
      if (!item.stat || !text.includes(item.stat))
        throw new Error(`効果がない: ${item.name}`)
      if (item.carried !== 0 || item.stored !== 3)
        throw new Error("在庫の前提が違う")
    }
    if (!text.includes("各ワザの残り +2"))
      throw new Error("補充が各ワザへの効果と分からない")
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== expected.save
    )
      throw new Error("閲覧で状態変化")
    for (const item of expected.items) {
      await dialog
        .getByRole("button", { name: `${item.name}を持ち出す`, exact: true })
        .click()
    }
    let prepared = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      const supplies = game.queries.supplies(game.state)
      if (
        supplies.count !== 4 ||
        supplies.items.some((item) => item.carried !== 1 || item.stored !== 2)
      )
        throw new Error("実際の持ち出し設定が違う")
      return JSON.stringify(game.save())
    })
    for (const item of expected.items) {
      await dialog
        .getByRole("button", { name: `${item.name}を持ち出す`, exact: true })
        .click()
    }
    const status = dialog.getByRole("status")
    if (
      !(await status.innerText()).includes(
        "持ち出し枠がいっぱいです。入れ替えるには、先に倉庫へ戻してください。"
      )
    )
      throw new Error("満杯の理由がない")
    for (const item of expected.items) {
      if (
        !(await dialog
          .getByRole("button", { name: `${item.name}を持ち出す`, exact: true })
          .isDisabled())
      )
        throw new Error("満杯でも追加できる")
    }
    await page.screenshot({
      path: `/tmp/dnd-supplies-full-${viewport.name}.png`,
    })
    await dialog
      .getByRole("button", {
        name: `${expected.items[0].name}を倉庫へ戻す`,
        exact: true,
      })
      .click()
    if (!(await status.innerText()).includes("あと1個持ち出せます。"))
      throw new Error("空き枠の表示が違う")
    for (const item of expected.items) {
      if (
        await dialog
          .getByRole("button", { name: `${item.name}を持ち出す`, exact: true })
          .isDisabled()
      )
        throw new Error("空きができても追加できない")
    }
    prepared = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      if (game.queries.supplies(game.state).count !== 7)
        throw new Error("戻した後の持ち出し数が違う")
      return JSON.stringify(game.save())
    })
    for (const button of await dialog.getByRole("button").all()) {
      const bounds = await button.boundingBox()
      if (!bounds || bounds.x < 0 || bounds.x + bounds.width > viewport.width)
        throw new Error("持ち出し操作が画面外")
    }
    const close = dialog.getByRole("button", {
      name: "持ち出しを閉じる",
      exact: true,
    })
    const closeBounds = await close.boundingBox()
    const dialogBounds = await dialog.boundingBox()
    if (
      !closeBounds ||
      !dialogBounds ||
      closeBounds.y < dialogBounds.y ||
      closeBounds.y + closeBounds.height > dialogBounds.y + dialogBounds.height
    )
      throw new Error("スクロール後の閉じるが見えない")
    await page.screenshot({
      path: `/tmp/dnd-supplies-effects-${viewport.name}.png`,
    })
    await close.click()
    await dialog.waitFor({ state: "hidden" })
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== prepared
    )
      throw new Error("閉じる操作で持ち出し設定が変化")
    console.log(
      `${viewport.name}: 4種類の効果・実際の持ち出し・閉じた後の設定保持を確認`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
