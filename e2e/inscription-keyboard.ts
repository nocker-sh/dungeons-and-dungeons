import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import goods from "../src/lib/content/data/goods.json"
import shops from "../src/lib/content/data/shops.json"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
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
            scene: "smithy-repair",
            duration: 15000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const expected = await page.evaluate(
      async ({ sword, shop }) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const game = runtime.game!
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: { ...saved.snapshot, gold: 100000 },
        })
        if (issue) throw issue
        for (let index = 0; index < 2; index++)
          if (!Array.isArray(game.send({ type: "buy", shop, good: sword })))
            throw new Error("購入失敗")
        const bought = game.save()
        const upgradedId = bought.snapshot.gear.at(-1)!.id
        const upgraded = game.restore({
          ...bought,
          snapshot: {
            ...bought.snapshot,
            gear: bought.snapshot.gear.map((entry) =>
              entry.id === upgradedId ? { ...entry, plus: 3 } : entry
            ),
          },
        })
        if (upgraded) throw upgraded
        await runtime.advance(3500)
        return {
          names: game.queries
            .smithy(game.state)!
            .inscriptions.filter(
              (entry) =>
                game.state.gear.find((gear) => gear.id === entry.gear)?.good ===
                sword
            )
            .map((entry) => entry.name),
          save: JSON.stringify(game.save()),
        }
      },
      {
        sword: goods.find((entry) => entry.slug === "sword")!.id,
        shop: shops.find((entry) => entry.slug === "armory")!.id,
      }
    )
    await page.getByRole("button", { name: /ワザの付け替え/ }).click()
    const dialog = page.getByRole("dialog", { name: "ワザの付け替え" })
    const buttons = dialog.getByRole("button")
    await buttons.first().waitFor({ state: "visible" })
    if (
      !(await buttons
        .first()
        .evaluate((element) => element === document.activeElement))
    )
      throw new Error("最初の操作にフォーカスがない")
    await page.keyboard.press("Shift+Tab")
    if (
      !(await buttons
        .last()
        .evaluate((element) => element === document.activeElement))
    )
      throw new Error("逆Tabが画面外へ出る")
    await page.keyboard.press("Tab")
    if (
      !(await buttons
        .first()
        .evaluate((element) => element === document.activeElement))
    )
      throw new Error("Tabが画面外へ出る")
    for (const name of expected.names)
      if (!(await dialog.innerText()).includes(name))
        throw new Error("武器名が欠ける")
    const upgraded = dialog
      .locator("div")
      .filter({ hasText: /^鉄の剣\+3（未装備）$/ })
      .last()
    const row = upgraded.locator("..")
    await row.getByRole("button").first().click()
    if (!(await dialog.innerText()).includes("鉄の剣+3："))
      throw new Error("選択した強化武器が違う")
    await page.screenshot({
      path: `/tmp/dnd-inscription-plus-${viewport.name}.png`,
    })
    await page.keyboard.press("Escape")
    if (!(await dialog.innerText()).includes("鉄の剣+3（未装備）"))
      throw new Error("Escapeで武器一覧に戻れない")
    await row.getByRole("button").first().click()
    await page.keyboard.press("Backspace")
    if (!(await dialog.innerText()).includes("鉄の剣+3（未装備）"))
      throw new Error("Backspaceで武器一覧に戻れない")
    await page.keyboard.press("Escape")
    if (await dialog.count()) throw new Error("Escapeで閉じられない")
    await page.getByRole("button", { name: /ワザの付け替え/ }).click()
    await page.keyboard.press("Backspace")
    if (await dialog.count()) throw new Error("Backspaceで閉じられない")
    await page.waitForFunction(() =>
      document.activeElement?.matches("[data-inscription-trigger]")
    )
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== expected.save
    )
      throw new Error("選択で保存が変わる")
    console.log(
      `${viewport.name}: Escape/Backspaceで選択取消・閉じる・保存保持`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
