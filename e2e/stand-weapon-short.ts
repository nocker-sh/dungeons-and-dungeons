import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"
import goods from "../src/lib/content/data/goods.json"
import shops from "../src/lib/content/data/shops.json"
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
            scene: "stand",
            duration: 15000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    await page.evaluate(async () => {
      await window.__devStudio!.advance(2500)
    })
    // 主人公の能力は育たない（作品データの値で固定）ので、剣を持てる仲間の立ち絵で確かめる
    const target = await page.evaluate(
      ({ sword, shop }) => {
        const game = (window.__devStudio as StudioRuntime).game!
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: { ...saved.snapshot, gold: 100000 },
        })
        if (issue) throw issue
        if (!Array.isArray(game.send({ type: "buy", shop, good: sword })))
          throw new Error("購入失敗")
        const gear = game.state.gear.at(-1)!
        const member = game.state.party.find(
          (id) =>
            !game.queries.member(game.state, id)!.hero &&
            game.queries
              .equipOptions(game.state, id)
              .some((entry) => entry.gear === gear.id)
        )
        const reverted = game.restore(saved)
        if (reverted) throw reverted
        if (!member) throw new Error("剣を持てる仲間がいない")
        return {
          id: member,
          name: game.queries.member(game.state, member)!.name,
        }
      },
      {
        sword: goods.find((entry) => entry.slug === "sword")!.id,
        shop: shops.find((entry) => entry.slug === "armory")!.id,
      }
    )
    await page
      .getByRole("button", { name: "立ち絵を閉じる", exact: true })
      .click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(3000)
    })
    await page.locator(`.card .hit[aria-label^="${target.name} HP"]`).click()
    for (const [index, condition] of [
      "strength",
      "both",
      "technique",
      "met",
    ].entries()) {
      const expected = await page.evaluate(
        async ({ index, condition, sword, shop, target }) => {
          const runtime = window.__devStudio as StudioRuntime
          const game = runtime.game!
          const saved = game.save()
          const issue = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              gold: 100000,
              members: saved.snapshot.members.map((member) => ({
                ...member,
                stats: {
                  ...member.stats,
                  str:
                    condition === "technique" || condition === "met" ? 30 : 0,
                  tec:
                    condition === "both" || condition === "technique" ? 0 : 30,
                },
              })),
            },
          })
          if (issue) throw issue
          if (!Array.isArray(game.send({ type: "buy", shop, good: sword })))
            throw new Error("購入失敗")
          const gear = game.state.gear.at(-1)!
          const bought = game.save()
          const plus = condition === "both" || condition === "met" ? 3 : 0
          const upgraded = game.restore({
            ...bought,
            snapshot: {
              ...bought.snapshot,
              gear: bought.snapshot.gear.map((entry) =>
                entry.id === gear.id ? { ...entry, plus } : entry
              ),
            },
          })
          if (upgraded) throw upgraded
          if (
            !Array.isArray(
              game.send({
                type: "equip",
                gear: gear.id,
                member: target,
              })
            )
          )
            throw new Error("装備失敗")
          await runtime.advance(5000 + index * 2500)
          const member = game.queries.member(game.state, target)!
          if (!member.weapon) throw new Error("武器がない")
          return {
            short: member.weapon.short,
            weaponName: member.weapon?.name ?? "なし",
            weaponPlus: member.weapon.plus,
            weaponTypeName: member.weapon.typeName,
            save: JSON.stringify(game.save()),
          }
        },
        {
          index,
          condition,
          target: target.id,
          sword: goods.find((entry) => entry.slug === "sword")!.id,
          shop: shops.find((entry) => entry.slug === "armory")!.id,
        }
      )
      const label = page.locator("[data-stand-weapon-short]")
      if (
        (await page
          .locator("[data-stand-stats]")
          .evaluate((element) =>
            Number.parseFloat(getComputedStyle(element).fontSize)
          )) < 10
      )
        throw new Error("仲間情報の文字が小さすぎる")
      if (condition === "met") {
        if (expected.short.str || expected.short.tec)
          throw new Error("能力充足の条件が違う")
        if (await label.count()) throw new Error("能力を満たしても警告が残る")
      } else {
        await label.waitFor({ state: "visible" })
        await label.scrollIntoViewIfNeeded()
        const text = await label.innerText()
        const expectedText = [
          expected.short.str ? `筋力 ${expected.short.str}不足` : null,
          expected.short.tec ? `技量 ${expected.short.tec}不足` : null,
        ]
          .filter(Boolean)
          .join("・")
        if (!expectedText || text !== expectedText)
          throw new Error("能力不足の説明が違う")
        const fontSize = await label.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize)
        )
        if (fontSize < 11) throw new Error("能力不足の説明が小さすぎる")
        const bounds = await label.boundingBox()
        if (
          !bounds ||
          bounds.x < 0 ||
          bounds.x + bounds.width > viewport.width ||
          bounds.y < 0 ||
          bounds.y + bounds.height > viewport.height
        )
          throw new Error("能力不足の説明が画面外")
      }
      const weapon = page.locator("[data-stand-weapon]")
      if (!(await weapon.innerText()).includes(expected.weaponName))
        throw new Error("装備中の武器名が違う")
      const expectedWeapon = `${expected.weaponName}${expected.weaponPlus ? `+${expected.weaponPlus}` : ""}（${expected.weaponTypeName}）`
      if (!(await weapon.innerText()).includes(expectedWeapon))
        throw new Error("武器の強化段階が違う")
      if (
        (await weapon.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize)
        )) < 11
      )
        throw new Error("武器の説明が小さすぎる")
      const weaponBounds = await weapon.boundingBox()
      if (
        !weaponBounds ||
        weaponBounds.x < 0 ||
        weaponBounds.x + weaponBounds.width > viewport.width ||
        weaponBounds.y < 0 ||
        weaponBounds.y + weaponBounds.height > viewport.height
      )
        throw new Error("武器の説明が画面外")
      await page.screenshot({
        path: `/tmp/dnd-stand-weapon-short-${viewport.name}-${condition}.png`,
      })
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== expected.save
      )
        throw new Error("閲覧で保存が変わる")
      console.log(`${viewport.name}/${condition}: 武器能力不足・保存保持`)
    }
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
