import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import goods from "../src/lib/content/data/goods.json"
import shops from "../src/lib/content/data/shops.json"
import smithy from "../src/lib/content/data/smithy.json"
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
      async ({ sword, shop, book }) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const game = runtime.game!
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            gold: 100000,
            bag: [
              ...saved.snapshot.bag.filter((entry) => entry.good !== book),
              { good: book, count: 2 },
            ],
          },
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
          gear: upgradedId,
          candidate: game.queries
            .smithy(game.state)!
            .inscriptions.find((entry) => entry.gear === upgradedId)!
            .candidates[0],
        }
      },
      {
        book: smithy.skillBook,
        sword: goods.find((entry) => entry.slug === "sword")!.id,
        shop: shops.find((entry) => entry.slug === "armory")!.id,
      }
    )
    await page.getByRole("button", { name: /ワザの付け替え/ }).click()
    const dialog = page.getByRole("dialog", { name: "ワザの付け替え" })
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
    await dialog.getByRole("button", { name: "武器を選び直す" }).click()
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== expected.save
    )
      throw new Error("選択で保存が変わる")
    await row.getByRole("button").first().click()
    await dialog
      .getByRole("button", { name: new RegExp(expected.candidate.name) })
      .click()
    const after = await page.evaluate(() =>
      JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
    )
    const beforeSave = JSON.parse(expected.save)
    const afterSave = JSON.parse(after)
    const expectedGear = beforeSave.snapshot.gear.map(
      (entry: { id: string; weapon?: { skills: string[] } }) =>
        entry.id === expected.gear
          ? {
              ...entry,
              weapon: {
                ...entry.weapon,
                skills: entry.weapon!.skills.map((skill, index) =>
                  index === 1 ? expected.candidate.id : skill
                ),
              },
            }
          : entry
    )
    if (
      JSON.stringify(afterSave.snapshot.gear) !== JSON.stringify(expectedGear)
    )
      throw new Error("選択枠以外の武器が変わる")
    const expectedBag = beforeSave.snapshot.bag.map(
      (entry: { good: string; count: number }) =>
        entry.good === smithy.skillBook
          ? { ...entry, count: entry.count - 1 }
          : entry
    )
    if (JSON.stringify(afterSave.snapshot.bag) !== JSON.stringify(expectedBag))
      throw new Error("書の消費が違う")
    if (afterSave.snapshot.gold !== beforeSave.snapshot.gold)
      throw new Error("金貨が変わる")
    if (!(await dialog.innerText()).includes("変更しました"))
      throw new Error("変更結果がない")
    await page.screenshot({
      path: `/tmp/dnd-inscription-use-${viewport.name}.png`,
    })
    console.log(`${viewport.name}: 強化武器の選択・書1冊消費・他の武器保持`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
