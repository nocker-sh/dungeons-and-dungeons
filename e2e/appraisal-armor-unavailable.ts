import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
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
            scene: "shop-appraise-armor",
            duration: 20000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const previousGear = await page.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(3500)
      const game = runtime.game!
      const saved = game.save()
      const issue = game.restore({
        ...saved,
        snapshot: { ...saved.snapshot, party: [saved.snapshot.party[0]] },
      })
      if (issue) throw issue
      return game.state.gear.map((gear) => gear.id)
    })
    await page.getByRole("button", { name: "鑑定", exact: true }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4000)
    )
    await page
      .locator(".rows")
      .getByRole("button", { name: "ガラクタ", exact: true })
      .click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4500)
    )
    await page.getByRole("button", { name: "鑑定する", exact: true }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(10000)
    )
    const dialog = page.getByRole("dialog", { name: "鑑定の結果", exact: true })
    const expected = await page.evaluate((previousGear) => {
      const game = (window.__devStudio as StudioRuntime).game!
      const armor = game.queries
        .gear(game.state)
        .find(
          (gear) => !previousGear.includes(gear.gear) && gear.kind === "armor"
        )!
      if (!armor) throw new Error("実際の鑑定で防具が出ない")
      const eligible = game.state.party.filter((member) =>
        game.queries
          .equipOptions(game.state, member)
          .some((gear) => gear.gear === armor.gear)
      )
      if (eligible.length) throw new Error("装備できない編成の前提がない")
      return { name: armor.name, description: armor.desc, save: game.save() }
    }, previousGear)
    if (!(await dialog.innerText()).includes(expected.name))
      throw new Error("防具の発見名が違う")
    await dialog
      .getByRole("button", { name: "押して一覧へ", exact: true })
      .click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(11000)
    )
    if (
      !(
        await page
          .getByRole("region", { name: "選んだ品の詳細", exact: true })
          .innerText()
      ).includes(expected.name)
    )
      throw new Error("鑑定した防具が最初から選択されない")
    const details = page.getByRole("region", {
      name: "選んだ品の詳細",
      exact: true,
    })
    if (
      !(await details.innerText()).includes(
        "今の編成に装備できる仲間はいません。"
      )
    )
      throw new Error("装備できない防具の理由がない")
    if (
      await page
        .getByRole("button", { name: "仲間に着せる", exact: true })
        .count()
    )
      throw new Error("装備できない防具に操作が出る")
    const text = await details.innerText()
    if (
      text.indexOf("今の編成に装備できる仲間はいません。") >
      text.indexOf(expected.description)
    )
      throw new Error("装備対象なしの案内が特徴文の後ろに埋もれる")
    if ((await details.evaluate((element) => element.scrollTop)) !== 0)
      throw new Error("鑑定品の初期詳細が先頭にない")
    await page.screenshot({
      path: `/tmp/dnd-appraisal-armor-unavailable-${viewport.name}.png`,
    })
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== JSON.stringify(expected.save)
    )
      throw new Error("装備できない防具の表示で保存が変わる")
    console.log(
      `${viewport.name}: 鑑定防具の対象なしの説明・操作制限・保存保持`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
