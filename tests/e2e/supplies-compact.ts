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
            bag: goods.map((good) => ({
              good: good.id,
              count: good.slug === "potion" ? 1 : 3,
            })),
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
      if (!item.stat || !text.includes(item.stat))
        throw new Error(`効果がない: ${item.name}`)
      if (item.carried !== 0 || item.stored !== item.total)
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
        supplies.items.some(
          (item) => item.carried !== 1 || item.stored !== item.total - 1
        )
      )
        throw new Error("実際の持ち出し設定が違う")
      return JSON.stringify(game.save())
    })
    const potion = expected.items.find((item) => item.total === 1)!
    const add = dialog.getByRole("button", {
      name: `${potion.name}を持ち出す`,
      exact: true,
    })
    if (
      !(await add.isDisabled()) ||
      !(await dialog.getByText("倉庫の在庫なし", { exact: true }).isVisible())
    )
      throw new Error("在庫切れの理由がない")
    if (
      !(await dialog.getByRole("status").innerText()).includes(
        "あと4個持ち出せます。"
      )
    )
      throw new Error("枠の空きと在庫切れが違う")
    await dialog
      .getByRole("button", { name: `${potion.name}を倉庫へ戻す`, exact: true })
      .click()
    if (
      (await add.isDisabled()) ||
      (await dialog.getByText("倉庫の在庫なし", { exact: true }).count())
    )
      throw new Error("在庫を戻しても案内が解除されない")
    await add.click()
    prepared = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      if (game.queries.supplies(game.state).count !== 4)
        throw new Error("持ち替え後の合計が違う")
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
    const heading = dialog.getByText("倉庫と手持ち 4/8", { exact: true })
    const headingBounds = await heading.boundingBox()
    const closeBounds = await close.boundingBox()
    const dialogBounds = await dialog.boundingBox()
    if (
      !closeBounds ||
      !dialogBounds ||
      closeBounds.y < dialogBounds.y ||
      closeBounds.y + closeBounds.height > dialogBounds.y + dialogBounds.height
    )
      throw new Error("スクロール後の閉じるが見えない")
    if (
      !headingBounds ||
      !closeBounds ||
      Math.abs(
        headingBounds.y +
          headingBounds.height / 2 -
          closeBounds.y -
          closeBounds.height / 2
      ) > 2
    )
      throw new Error("見出しと閉じるが別の行")
    if (closeBounds.height < 44) throw new Error("閉じるの押せる高さが小さい")
    await page.screenshot({
      path: `/tmp/dnd-supplies-compact-${viewport.name}.png`,
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
