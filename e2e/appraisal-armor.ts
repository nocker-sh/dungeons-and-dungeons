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
        snapshot: { ...saved.snapshot, gold: 0 },
      })
      if (issue) throw issue
      return {
        gear: game.state.gear.map((gear) => gear.id),
        gold: game.state.gold,
        junk: game.queries.junk(game.state).count,
      }
    })
    await page.getByRole("button", { name: "鑑定", exact: true }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4000)
    )
    if (
      !(await page
        .getByText("鑑定は無料。拾った武器は、前の持ち主の強化も調べます。", {
          exact: true,
        })
        .isVisible())
    )
      throw new Error("無料鑑定の説明が見えない")
    await page.screenshot({
      path: `/tmp/dnd-appraisal-free-${viewport.name}.png`,
    })
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
          (gear) =>
            !previousGear.gear.includes(gear.gear) && gear.kind === "armor"
        )!
      if (!armor) throw new Error("実際の鑑定で防具が出ない")
      if (
        game.state.gold !== previousGear.gold ||
        game.queries.junk(game.state).count !== previousGear.junk - 1
      )
        throw new Error("無料の単品鑑定の消費が違う")
      const target = game.state.party.find((member) =>
        game.queries
          .equipOptions(game.state, member)
          .some((gear) => gear.gear === armor.gear)
      )!
      if (!target) throw new Error("防具を着せる対象がいない")
      const comparison = game.queries.armorComparison(
        game.state,
        target,
        armor.gear
      )!
      return {
        gear: armor.gear,
        name: armor.name,
        target,
        comparison,
        save: game.save(),
      }
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
    await page
      .getByRole("button", { name: "仲間に着せる", exact: true })
      .click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(12000)
    )
    const details = page.getByRole("region", {
      name: "着替え後の比較",
      exact: true,
    })
    const { before, after } = expected.comparison
    if (
      !(await details.innerText()).includes(
        `耐久 ${before.durability}/${before.maxDurability} → ${after.durability}/${after.maxDurability}`
      )
    )
      throw new Error("鑑定防具の装備比較が違う")
    await page.screenshot({
      path: `/tmp/dnd-appraisal-armor-${viewport.name}.png`,
    })
    await page.keyboard.press("Escape")
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== JSON.stringify(expected.save)
    )
      throw new Error("鑑定防具の装備取消で保存が変わる")
    await page
      .getByRole("button", { name: "仲間に着せる", exact: true })
      .click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(12500)
    )
    await page
      .locator(
        `.card .hit[aria-describedby="target-detail-${expected.target}"]`
      )
      .click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(14000)
    )
    const actual = await page.evaluate(({ gear, target }) => {
      const game = (window.__devStudio as StudioRuntime).game!
      return {
        owner: game.state.gear.find((entry) => entry.id === gear)?.owner,
        armor: game.queries.member(game.state, target)!.armor,
        member: game.queries.member(game.state, target)!,
        save: game.save(),
      }
    }, expected)
    if (
      actual.owner !== expected.target ||
      actual.armor?.durability !== after.durability ||
      actual.member.hp !== after.hp ||
      actual.member.maxHp !== after.maxHp
    )
      throw new Error("実際の鑑定防具の装備結果が違う")
    if (
      actual.save.snapshot.gold !== expected.save.snapshot.gold ||
      JSON.stringify(actual.save.snapshot.bag) !==
        JSON.stringify(expected.save.snapshot.bag)
    )
      throw new Error("着せる操作で鑑定後の資産が変わる")
    console.log(`${viewport.name}: 防具の実鑑定・比較・取消・装備と資産保持`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
