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
            scene: "shop-armory-junk",
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
        snapshot: {
          ...saved.snapshot,
          members: saved.snapshot.members.map((member) => ({
            ...member,
            stats: { ...member.stats, str: 30 },
          })),
        },
      })
      if (issue) throw issue
      return game.state.gear.map((gear) => gear.id)
    })
    await page.getByRole("button", { name: "鑑定", exact: true }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4000)
    )
    await page.getByRole("button", { name: /まとめて鑑定/ }).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(4500)
    )
    await page
      .getByRole("button", { name: "全部鑑定する", exact: true })
      .click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(10000)
    )
    const dialog = page.getByRole("dialog", { name: "鑑定の結果", exact: true })
    const revealedText = await dialog.innerText()
    const result = await page.evaluate(
      ({ previousGear, revealedText }) => {
        const game = (window.__devStudio as StudioRuntime).game!
        const found = game.queries
          .gear(game.state)
          .find(
            (entry) =>
              !previousGear.includes(entry.gear) &&
              entry.weapon &&
              revealedText.includes(entry.name)
          )!
        if (!found) throw new Error("鑑定結果の武器が特定できない")
        const best = game.queries.upgrades(game.state, found.gear)[0]
        if (!best) throw new Error("攻撃力が上がる鑑定結果の前提がない")
        return {
          name: found.name,
          gear: found.gear,
          member: best.member,
          memberName: best.name,
          attack: best.after,
          notice: `${best.name}が持つと 攻撃力 ${best.before} → ${best.after}`,
          save: JSON.stringify(game.save()),
        }
      },
      { previousGear, revealedText }
    )
    if (!revealedText.includes(result.notice))
      throw new Error("鑑定結果の攻撃力上昇がQueryと一致しない")
    if (revealedText.includes("今の編成では攻撃力が上がる仲間はいません"))
      throw new Error("上昇する武器へ上昇なしを表示した")
    await page.screenshot({
      path: `/tmp/dnd-appraisal-upgrade-${viewport.name}.png`,
    })
    await dialog
      .getByRole("button", { name: "押して一覧へ", exact: true })
      .click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(12000)
    )

    const details = page.getByRole("region", {
      name: "選んだ品の詳細",
      exact: true,
    })
    if (!(await details.innerText()).includes(result.name))
      throw new Error("鑑定した武器が最初から選択されない")
    if (!(await details.innerText()).includes(result.notice))
      throw new Error("一覧の攻撃力上昇がQueryと一致しない")
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== result.save
    )
      throw new Error("結果を読む操作で保存が変わる")
    await page
      .getByRole("button", {
        name: `${result.memberName}に持たせる`,
        exact: true,
      })
      .click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(15000)
    )
    const actual = await page.evaluate(({ member, gear }) => {
      const game = (window.__devStudio as StudioRuntime).game!
      return {
        attack: game.queries.member(game.state, member)!.weapon?.attack,
        owner: game.state.gear.find((entry) => entry.id === gear)?.owner,
        save: game.save(),
      }
    }, result)
    if (actual.owner !== result.member || actual.attack !== result.attack)
      throw new Error("鑑定一覧から装備した結果が予告と一致しない")
    const before = JSON.parse(result.save)
    if (
      actual.save.snapshot.gold !== before.snapshot.gold ||
      JSON.stringify(actual.save.snapshot.bag) !==
        JSON.stringify(before.snapshot.bag)
    )
      throw new Error("装備操作で鑑定後の金貨や品物が変わる")
    const transfer = await page.evaluate((gear) => {
      const game = (window.__devStudio as StudioRuntime).game!
      const best = game.queries.upgrades(game.state, gear)[0]
      if (!best) throw new Error("別の仲間へ渡す前提がない")
      return best
    }, result.gear)
    // 同じ名前の武器が複数見つかることがあるので、装備した品そのものの行を押す
    await page.locator(`[data-row-key="${result.gear}"]`).click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(15500)
    )
    const transferredText = await details.innerText()
    if (
      !transferredText.includes(
        `${result.memberName}から受け取る（${result.memberName}は武器なしになる）`
      )
    )
      throw new Error("鑑定一覧で元の仲間の武器が外れる説明がない")
    if (
      !transferredText.includes(
        `${transfer.name}が持つと 攻撃力 ${transfer.before} → ${transfer.after}`
      )
    )
      throw new Error("装備後に別の仲間の比較へ更新されない")
    await page.screenshot({
      path: `/tmp/dnd-appraisal-transfer-${viewport.name}.png`,
    })
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== JSON.stringify(actual.save)
    )
      throw new Error("受け渡しの説明を読む操作で保存が変わる")
    await page
      .getByRole("button", { name: `${transfer.name}に持たせる`, exact: true })
      .click()
    await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).advance(18000)
    )
    const transferred = await page.evaluate(
      ({ gear, member, previous }) => {
        const game = (window.__devStudio as StudioRuntime).game!
        return {
          owner: game.state.gear.find((entry) => entry.id === gear)?.owner,
          attack: game.queries.member(game.state, member)!.weapon?.attack,
          previousWeapon: game.queries
            .gear(game.state)
            .some(
              (entry) => entry.kind === "weapon" && entry.ownerId === previous
            ),
          save: game.save(),
        }
      },
      { gear: result.gear, member: transfer.member, previous: result.member }
    )
    if (
      transferred.owner !== transfer.member ||
      transferred.attack !== transfer.after ||
      transferred.previousWeapon
    )
      throw new Error("鑑定一覧からの受け渡し結果が違う")
    if (
      transferred.save.snapshot.gold !== actual.save.snapshot.gold ||
      JSON.stringify(transferred.save.snapshot.bag) !==
        JSON.stringify(actual.save.snapshot.bag)
    )
      throw new Error("受け渡しで金貨や品物が変わる")
    console.log(`${viewport.name}: 鑑定・装備・別の仲間への受け渡しと資産保持`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
