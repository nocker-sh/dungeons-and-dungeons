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
        const owner = game.state.party[0]!
        if (
          !Array.isArray(
            game.send({ type: "equip", gear: upgradedId, member: owner })
          )
        )
          throw new Error("装備失敗")
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
          ownerName: game.queries.member(game.state, owner)!.name,
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
      .filter({ hasText: new RegExp(`^鉄の剣\\+3（${expected.ownerName}）$`) })
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
    if ((await dialog.getByRole("status").innerText()) !== "")
      throw new Error("次の選択に前の成功通知が残る")
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
    const candidate = await page.evaluate((gear) => {
      const game = (window.__devStudio as StudioRuntime).game!
      return game.queries
        .smithy(game.state)!
        .inscriptions.find((entry) => entry.gear === gear)!.candidates[0]
    }, expected.gear)
    await row.getByRole("button").first().click()
    if ((await dialog.getByRole("status").innerText()) !== "")
      throw new Error("変更後の次の選択に成功通知が残る")
    const nextCandidate = dialog.getByRole("button", {
      name: new RegExp(candidate.name),
    })
    if (
      !(await nextCandidate.evaluate(
        (element) => element === document.activeElement
      ))
    )
      throw new Error("変更候補へフォーカスがない")
    await page.keyboard.press("Enter")
    const spent = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      return {
        books: game.queries.smithy(game.state)!.books,
        save: JSON.stringify(game.save()),
      }
    })
    if (spent.books !== 0) throw new Error("書を使い切っていない")
    const spentSave = JSON.parse(spent.save)
    const finalGear = expectedGear.map(
      (entry: { id: string; weapon?: { skills: string[] } }) =>
        entry.id === expected.gear
          ? {
              ...entry,
              weapon: {
                ...entry.weapon,
                skills: entry.weapon!.skills.map((skill, index) =>
                  index === 1 ? candidate.id : skill
                ),
              },
            }
          : entry
    )
    if (JSON.stringify(spentSave.snapshot.gear) !== JSON.stringify(finalGear))
      throw new Error("2回目も選択枠以外が変わる")
    const memberWeapon = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      return game.queries.member(game.state, game.state.party[0]!)!.weapon!
    })
    const finalWeapon = finalGear.find(
      (entry: { id: string }) => entry.id === expected.gear
    )!
    if (memberWeapon.gear !== expected.gear || memberWeapon.plus !== 3)
      throw new Error("装備中の強化武器が外れる")
    if (
      JSON.stringify(memberWeapon.skills.map((entry) => entry.id)) !==
      JSON.stringify(finalWeapon.weapon!.skills)
    )
      throw new Error("仲間のワザへ変更が反映されない")
    if (
      JSON.stringify(spentSave.snapshot.members) !==
      JSON.stringify(beforeSave.snapshot.members)
    )
      throw new Error("仲間の能力や使用履歴が変わる")
    const finalBag = expectedBag.filter(
      (entry: { good: string }) => entry.good !== smithy.skillBook
    )
    if (JSON.stringify(spentSave.snapshot.bag) !== JSON.stringify(finalBag))
      throw new Error("使い切った書以外の袋が変わる")
    if (spentSave.snapshot.gold !== beforeSave.snapshot.gold)
      throw new Error("2回目で金貨が変わる")
    await row.getByRole("button").first().click()
    const disabled = dialog.locator("button:disabled")
    if (!(await disabled.count()))
      throw new Error("0冊の変更候補が無効にならない")
    for (const candidate of await disabled.all()) {
      const appearance = await candidate.evaluate((element) => {
        const style = getComputedStyle(element)
        return { opacity: style.opacity, borderStyle: style.borderTopStyle }
      })
      if (appearance.opacity !== "1" || appearance.borderStyle !== "dashed")
        throw new Error("無効な候補の説明が薄くなる")
    }
    if ((await dialog.locator("button:not(:disabled)").count()) !== 2)
      throw new Error("0冊でも変更できる候補がある")
    if (
      !(await dialog
        .getByRole("button", { name: "武器を選び直す" })
        .evaluate((element) => element === document.activeElement))
    )
      throw new Error("0冊時のフォーカスがない")
    await page.keyboard.press("Tab")
    const reason = dialog.locator("[data-inscription-no-book]")
    if ((await reason.innerText()) !== "スキルの書がないため変更できません。")
      throw new Error("変更できない理由がない")
    const reasonBounds = await reason.boundingBox()
    if (
      !reasonBounds ||
      reasonBounds.y < 0 ||
      reasonBounds.y + reasonBounds.height > viewport.height
    )
      throw new Error("変更できない理由が画面外")
    if (
      !(await dialog
        .getByRole("button", { name: "閉じる", exact: true })
        .evaluate((element) => element === document.activeElement))
    )
      throw new Error("無効な候補にTabが止まる")
    await page.screenshot({
      path: `/tmp/dnd-inscription-equipped-${viewport.name}.png`,
    })
    await page.keyboard.press("Escape")
    await page.keyboard.press("Escape")
    if (await dialog.count()) throw new Error("0冊でも閉じられない")
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== spent.save
    )
      throw new Error("0冊での閲覧で保存が変わる")
    console.log(
      `${viewport.name}: 装備中の変更・仲間ワザ反映・書消費・他の資産保持`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
