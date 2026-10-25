import goods from "../src/lib/content/data/goods.json"
import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"

const weaponFixture = goods.find((good) => good.slug === "greatsword")!
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
            scene: "outskirts",
            duration: 15000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const expected = await page.evaluate(async (weaponFixture) => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(3500)
      const game = runtime.game!
      const armorFixture = game.queries
        .destinations(game.state)
        .find(
          (entry) => entry.id === game.queries.defaultDestination(game.state)
        )!.armorFinds[0]
      const armorOwner = armorFixture?.equipMembers[0]
      if (armorOwner) {
        const saved = game.save()
        const oldArmor = new Set(
          game.queries
            .gear(game.state)
            .filter(
              (gear) =>
                gear.kind === "armor" &&
                armorFixture.equipMembers.some(
                  (member) => member.id === gear.ownerId
                )
            )
            .map((gear) => gear.gear)
        )
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            gear: [
              ...saved.snapshot.gear.map((gear) =>
                oldArmor.has(gear.id) ||
                (gear.owner === armorOwner.id &&
                  game.queries
                    .gear(game.state)
                    .find((entry) => entry.gear === gear.id)?.kind === "weapon")
                  ? { ...gear, owner: null }
                  : gear
              ),
              {
                id: "goal-current-weapon",
                good: weaponFixture.id,
                owner: armorOwner.id,
                plus: 0,
                wear: 0,
                progress: 0,
                weapon: {
                  rarity: "N",
                  extraPower: 0,
                  skills: weaponFixture.skills!,
                },
              },
              {
                id: "goal-current-armor",
                good: armorFixture.id,
                owner: armorOwner.id,
                plus: 1,
                wear: 2,
                progress: 0,
                weapon: null,
              },
            ],
          },
        })
        if (issue) throw issue
      }
      const destination = game.queries
        .destinations(game.state)
        .find(
          (entry) => entry.id === game.queries.defaultDestination(game.state)
        )!
      const first = destination.weaponFinds[0]
      if (!first?.weapon) throw new Error("鑑定武器の目標がない")
      return {
        no: destination.no,
        names: destination.weaponFinds.map((good) => good.name),
        first: first.name,
        firstId: first.id,
        favoriteGoal: destination.weaponFinds.flatMap((goal) => {
          const matches = goal.equipMembers.flatMap((member) => {
            const fit = game.queries.weaponFit(game.state, member.id, goal.id)!
            const before =
              game.queries.member(game.state, member.id)?.weapon?.attack ?? 1
            return fit.favorite
              ? [`${member.name}：${before} → ${fit.attack}（得意）`]
              : []
          })
          return matches.length ? [{ name: goal.name, matches }] : []
        })[0],
        targets: first.equipMembers.map((member) => member.name),
        attackComparisons: first.equipMembers.map((member) => ({
          name: member.name,
          before:
            game.queries.member(game.state, member.id)?.weapon?.attack ?? 1,
          after: game.queries.weaponFit(game.state, member.id, first.id)!
            .attack,
          favorite: game.queries.weaponFit(game.state, member.id, first.id)!
            .favorite,
        })),
        shortages: first.equipMembers.flatMap((member) => {
          const fit = game.queries.weaponFit(game.state, member.id, first.id)
          return fit && !fit.met ? [{ name: member.name, ...fit.short }] : []
        }),
        armorGoal: destination.armorFinds[0]
          ? {
              name: destination.armorFinds[0].name,
              targets: destination.armorFinds[0].equipMembers.map(
                (member) => member.name
              ),
              comparisons: destination.armorFinds[0].equipMembers.map(
                (member) => {
                  const comparison = game.queries.armorGoalComparison(
                    game.state,
                    member.id,
                    destination.armorFinds[0].id
                  )!
                  return `${member.name}：耐久 ${comparison.before.durability}/${comparison.before.maxDurability} → ${comparison.after.durability}/${comparison.after.maxDurability}`
                }
              ),
              attackChanges: destination.armorFinds[0].equipMembers.flatMap(
                (member) => {
                  const comparison = game.queries.armorGoalComparison(
                    game.state,
                    member.id,
                    destination.armorFinds[0].id
                  )!
                  return comparison.before.attack !== comparison.after.attack
                    ? [
                        `攻撃力 ${comparison.before.attack} → ${comparison.after.attack}`,
                      ]
                    : []
                }
              ),
              currentArmor: destination.armorFinds[0].equipMembers.map(
                (member) => {
                  const armor = game.queries
                    .gear(game.state)
                    .find(
                      (gear) =>
                        gear.ownerId === member.id && gear.kind === "armor"
                    )
                  return `${member.name}の現在の防具：${armor ? `${armor.name}（${armor.stat}）` : "防具なし"}`
                }
              ),
            }
          : null,
        weaponTotal: destination.weaponFinds.length,
        armorTotal: destination.armorFinds.length,
        ownedWeapons: destination.weaponFinds.filter((good) => good.own > 0)
          .length,
        ownedArmor: destination.armorFinds.filter((good) => good.own > 0)
          .length,
        skills: first.weapon.skills
          .filter((skill) => !skill.random)
          .map((skill) => ({
            name: skill.name,
            uses: skill.uses,
            desc: skill.desc,
          })),
        save: JSON.stringify(game.save()),
      }
    }, weaponFixture)
    await page
      .getByRole("button", { name: "探索装備の目標を見る", exact: true })
      .click()
    await page.evaluate(async () => {
      await (window.__devStudio as StudioRuntime).advance(4500)
    })
    const dialog = page.getByRole("dialog", {
      name: `${expected.no}層の探索装備`,
      exact: true,
    })
    if (expected.armorGoal) {
      await dialog
        .getByRole("button", { name: expected.armorGoal.name, exact: true })
        .click()
      await page.evaluate(async () => {
        await (window.__devStudio as StudioRuntime).advance(4750)
      })
      const armorText = await dialog
        .getByRole("region", { name: "選んだ品の詳細", exact: true })
        .innerText()
      const notice = expected.armorGoal.targets.length
        ? `装備できる仲間：${expected.armorGoal.targets.join("・")}`
        : "今の編成に装備できる仲間はいません。"
      if (!armorText.includes(notice)) throw new Error("防具目標の対象が違う")
      if (!armorText.includes("未強化・消耗なしで着替えた目安："))
        throw new Error("防具比較の前提が表示されない")
      for (const [index, line] of expected.armorGoal.comparisons.entries()) {
        const current = expected.armorGoal.currentArmor[index]!
        const next = expected.armorGoal.currentArmor[index + 1]
        if (
          armorText.indexOf(line) < armorText.indexOf(current) ||
          (next && armorText.indexOf(line) > armorText.indexOf(next))
        )
          throw new Error("仲間の現在防具と比較が隣り合っていない")
      }
      for (const line of expected.armorGoal.comparisons)
        if (!armorText.includes(line))
          throw new Error(`防具の着替え目安が違う：${line}`)
      if (!expected.armorGoal.attackChanges.length)
        throw new Error("攻撃力が変わる防具比較の前提がない")
      for (const line of expected.armorGoal.attackChanges)
        if (!armorText.includes(line))
          throw new Error(`防具による攻撃力変化がない：${line}`)
      for (const line of expected.armorGoal.currentArmor)
        if (!armorText.includes(line))
          throw new Error(`現在の防具が表示されない：${line}`)
      if (!expected.armorGoal.currentArmor.some((line) => line.includes("+1")))
        throw new Error("強化防具の比較前提がない")
      if (
        !expected.armorGoal.currentArmor.some((line) =>
          line.endsWith("防具なし")
        )
      )
        throw new Error("防具なしの比較前提がない")
      await dialog
        .getByRole("region", { name: "選んだ品の詳細", exact: true })
        .evaluate((element) => {
          element.scrollTop = element.scrollHeight
        })
      await page.screenshot({
        path: `/tmp/dnd-find-current-armor-${viewport.name}.png`,
      })
    }
    if (
      !(await dialog.innerText()).includes(
        `現在所持：武器 ${expected.ownedWeapons}/${expected.weaponTotal}・防具 ${expected.ownedArmor}/${expected.armorTotal}種類`
      )
    )
      throw new Error("装備目標の所持種類が違う")
    if (
      !(await dialog.innerText()).includes(
        "鑑定候補は最深到達層で決まる。潜る層では変わらない。"
      )
    )
      throw new Error("鑑定候補が潜る層で変わらないことが分からない")
    await dialog.getByRole("button", { name: "武器", exact: true }).click()
    await page.evaluate(async () => {
      await (window.__devStudio as StudioRuntime).advance(5000)
    })
    for (const name of expected.names)
      if (
        (await dialog.getByRole("button", { name, exact: true }).count()) !== 1
      )
        throw new Error(`目標にない武器：${name}`)
    await dialog
      .getByRole("button", { name: expected.first, exact: true })
      .click()
    await page.evaluate(async () => {
      await (window.__devStudio as StudioRuntime).advance(5500)
    })
    const details = dialog.getByRole("region", {
      name: "選んだ品の詳細",
      exact: true,
    })
    await dialog.locator(".row").last().focus()
    await page.keyboard.press("Tab")
    if (
      !(await details.evaluate((element) => document.activeElement === element))
    )
      throw new Error("Tabで目標の詳細欄へ移動できない")
    await page.keyboard.press("End")
    await page.waitForTimeout(150)
    if (
      viewport.name === "small" &&
      !(await details.evaluate((element) => element.scrollTop > 0))
    )
      throw new Error("詳細の末尾へキーボードでスクロールできない")
    await page.keyboard.press("Home")
    await page.waitForTimeout(150)
    if ((await details.evaluate((element) => element.scrollTop)) !== 0)
      throw new Error("詳細の先頭へキーボードで戻れない")
    await page.keyboard.press("Shift+Tab")
    if (
      !(await dialog
        .locator(".row")
        .last()
        .evaluate((element) => document.activeElement === element))
    )
      throw new Error("詳細欄からShift+Tabで一覧へ戻れない")
    if (viewport.name === "small") {
      const height = await details.evaluate((element) => element.clientHeight)
      if (height < 140) throw new Error(`目標の詳細欄が狭い：${height}px`)
      const rowsHeight = await dialog
        .locator(".rowsbox")
        .evaluate((element) => element.clientHeight)
      if (rowsHeight < 88) throw new Error("目標一覧が2行分より狭い")
    }
    const targetNotice = expected.targets.length
      ? `装備できる仲間：${expected.targets.join("・")}`
      : "今の編成に装備できる仲間はいません。"
    if (!(await details.innerText()).includes(targetNotice))
      throw new Error("武器目標の対象が違う")
    if (!(await details.innerText()).includes("N・未強化の攻撃力の目安："))
      throw new Error("鑑定前の比較を未強化の目安と案内していない")
    for (const comparison of expected.attackComparisons) {
      if (
        !(await details.innerText()).includes(
          `${comparison.name}：${comparison.before} → ${comparison.after}（${comparison.favorite ? "得意" : "得意ではない"}）`
        )
      )
        throw new Error("武器目標の攻撃力比較がQueryと違う")
    }
    if (!expected.shortages.length)
      throw new Error("能力不足の仲間がいないため表示を検証できない")
    for (const shortage of expected.shortages) {
      const line = (await details.innerText())
        .split("\n")
        .find((text) => text.startsWith(`${shortage.name}：`))
      if (!line?.includes("足りない：攻撃力が下がる"))
        throw new Error("装備可能だが能力不足の仲間への案内がない")
      if (shortage.str && !line.includes(`筋力が${shortage.str}`))
        throw new Error("筋力不足の数値がQueryと違う")
      if (shortage.tec && !line.includes(`技量が${shortage.tec}`))
        throw new Error("技量不足の数値がQueryと違う")
    }
    if (!(await details.innerText()).includes("固定のワザ（未強化）："))
      throw new Error("強化前のワザであることが分からない")
    await details.evaluate((element) => {
      element.scrollTop = 0
    })
    await page.screenshot({
      path: `/tmp/dnd-find-fixed-effect-${viewport.name}.png`,
    })
    for (const skill of expected.skills) {
      const label = `${skill.name}（${skill.uses === null ? "回数制限なし" : `${skill.uses}回`}）`
      if (!(await details.innerText()).includes(label))
        throw new Error(`武器目標の固定ワザと回数が違う：${label}`)
      if (!(await details.innerText()).includes(`${label}：${skill.desc}`))
        throw new Error(`固定ワザの効果がQueryと違う：${skill.name}`)
    }
    if (
      !(await details.innerText()).includes(
        "追加のワザ・レア度・攻撃力の上振れは、鑑定で決まります。"
      )
    )
      throw new Error("鑑定で決まる内容の案内がない")
    if ((await details.innerText()).includes("この個体だけのワザ"))
      throw new Error("鑑定前の目標を個体として表示した")
    if (!expected.favoriteGoal)
      throw new Error("得意な武器を持つ目標の前提がない")
    await dialog
      .getByRole("button", { name: expected.favoriteGoal.name, exact: true })
      .click()
    await page.evaluate(async () => {
      await (window.__devStudio as StudioRuntime).advance(5750)
    })
    for (const line of expected.favoriteGoal.matches)
      if (!(await details.innerText()).includes(line))
        throw new Error("得意な武器の比較がQueryと一致しない")
    await dialog
      .getByRole("button", { name: expected.first, exact: true })
      .click()
    await page.evaluate(async () => {
      await (window.__devStudio as StudioRuntime).advance(6000)
    })
    await details.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await page.screenshot({
      path: `/tmp/dnd-weapon-find-goals-${viewport.name}.png`,
    })
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== expected.save
    )
      throw new Error("目標の確認で保存が変化")
    const ownedSave = await page.evaluate(async (goodId) => {
      const runtime = window.__devStudio as StudioRuntime
      const game = runtime.game!
      const saved = game.save()
      const destination = game.queries
        .destinations(game.state)
        .find(
          (entry) => entry.id === game.queries.defaultDestination(game.state)
        )!
      const weapon = destination.weaponFinds.find(
        (entry) => entry.id === goodId
      )!.weapon!
      const template = saved.snapshot.gear.find((entry) => entry.weapon)!
      const issue = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          gear: [
            ...saved.snapshot.gear,
            ...[1, 2].map((index) => ({
              ...template,
              id: `goal-owned-${index}`,
              owner: null,
              good: goodId,
              plus: index === 1 ? 1 : 0,
              progress: 0,
              wear: 0,
              weapon: {
                rarity: "N" as const,
                extraPower: 0,
                skills: weapon.skills.map((skill) => skill.id),
              },
            })),
          ],
        },
      })
      if (issue) throw issue
      const predicted = destination.weaponFinds
        .find((entry) => entry.id === goodId)!
        .equipMembers.map((member) => member.id)
      const actual = game.state.party.filter((member) =>
        game.queries
          .equipOptions(game.state, member)
          .some((entry) => entry.gear === "goal-owned-1")
      )
      if (JSON.stringify(predicted) !== JSON.stringify(actual))
        throw new Error("武器目標の対象と入手個体の装備ルールが違う")
      await runtime.advance(6500)
      return JSON.stringify(game.save())
    }, expected.firstId)
    if (
      !(await dialog.innerText()).includes(
        `現在所持：武器 ${expected.ownedWeapons + 1}/${expected.weaponTotal}・防具 ${expected.ownedArmor}/${expected.armorTotal}種類`
      )
    )
      throw new Error("同じ武器2個を2種類として数えた")
    if (
      !(
        await dialog
          .getByRole("button", { name: expected.first, exact: true })
          .innerText()
      ).includes("所持中")
    )
      throw new Error("所持状況が更新されない")
    const rowOrder = await dialog
      .locator(".row")
      .evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-row-key"))
      )
    if (rowOrder.at(-1) !== expected.firstId)
      throw new Error("所持した武器が未所持の目標より先に並ぶ")
    if (!(await details.innerText()).includes(expected.first))
      throw new Error("並び替えで選択した武器の詳細が消えた")
    const ownedLabels = await page.evaluate((goodId) => {
      const game = (window.__devStudio as StudioRuntime).game!
      return game.queries
        .destinations(game.state)
        .flatMap((destination) => destination.weaponFinds)
        .find((good) => good.id === goodId)!
        .ownedGear.map((gear) => `手持ち：${gear.name}（${gear.stat}・未装備）`)
    }, expected.firstId)
    if (ownedLabels.length !== 2 || !ownedLabels[0].includes("+1"))
      throw new Error("手持ち個体の強化段階を保持していない")
    for (const label of ownedLabels) {
      if (!(await details.innerText()).includes(label))
        throw new Error(`手持ち個体の性能が表示されない：${label}`)
    }
    await details.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await page.screenshot({
      path: `/tmp/dnd-weapon-find-owned-${viewport.name}.png`,
    })
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== ownedSave
    )
      throw new Error("所持表示で保存が変化")
    for (const [index, key] of ["Escape", "Backspace"].entries()) {
      await page.keyboard.press(key)
      await page.evaluate(
        async (time) => {
          await (window.__devStudio as StudioRuntime).advance(time)
        },
        7500 + index * 2000
      )
      await dialog.waitFor({ state: "detached" })
      const trigger = page.getByRole("button", {
        name: "探索装備の目標を見る",
        exact: true,
      })
      if (
        !(await trigger.evaluate(
          (element) => document.activeElement === element
        ))
      )
        throw new Error(`${key}後に目標ボタンへフォーカスが戻らない`)
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== ownedSave
      )
        throw new Error("目標を閉じると保存が変化")
      if (index === 0) {
        await page.keyboard.press("Enter")
        await page.evaluate(async () => {
          await (window.__devStudio as StudioRuntime).advance(8000)
        })
        await dialog.waitFor()
      }
    }
    console.log(`${viewport.name}: 鑑定武器の目標全品・ワザ・保存保持`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
