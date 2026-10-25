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
            scene: "battle-layer4",
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
      await window.__devStudio!.advance(9000)
    })
    for (const withStatuses of [true, false]) {
      const expected = await page.evaluate(
        async ({ withStatuses, sword, shop }) => {
          const runtime = window.__devStudio as StudioRuntime
          const game = runtime.game!
          const initial = game.save()
          const prep = game.restore({
            ...initial,
            snapshot: {
              ...initial.snapshot,
              phase: { type: "town" },
              gold: 100000,
            },
          })
          if (prep) throw prep
          if (!Array.isArray(game.send({ type: "buy", shop, good: sword })))
            throw new Error("購入失敗")
          const gear = game.state.gear.at(-1)!
          // 主人公は防具を着ないので、剣を持てて防具を着ている仲間で確かめる
          const member = game.state.party.find(
            (id) =>
              game.queries.member(game.state, id)?.armor &&
              game.queries
                .equipOptions(game.state, id)
                .some((entry) => entry.gear === gear.id)
          )
          if (!member) throw new Error("剣を持てて防具を着ている仲間がいない")
          if (
            !Array.isArray(
              game.send({
                type: "equip",
                gear: gear.id,
                member,
              })
            )
          )
            throw new Error("装備失敗")
          const armor = game.queries.member(game.state, member)!.armor!
          if (!armor) throw new Error("検証用の防具がない")
          const equipped = game.save()
          const back = game.restore({
            ...equipped,
            snapshot: {
              ...equipped.snapshot,
              phase: initial.snapshot.phase,
              gear: equipped.snapshot.gear.map((entry) =>
                entry.id === gear.id
                  ? { ...entry, plus: withStatuses ? 3 : 0 }
                  : entry.id === armor.gear
                    ? { ...entry, wear: withStatuses ? armor.maxDurability : 0 }
                    : entry
              ),
            },
          })
          if (back) throw back
          const saved = game.save()
          const issue = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              members: saved.snapshot.members.map((entry) =>
                entry.id === member
                  ? {
                      ...entry,
                      stats: {
                        ...entry.stats,
                        str: withStatuses ? 0 : 30,
                        tec: withStatuses ? 0 : 30,
                      },
                      status: withStatuses
                        ? [
                            { kind: "poison", turns: 3 },
                            { kind: "bind", turns: 2 },
                            { kind: "regen", turns: 4 },
                            { kind: "taunt", turns: 2 },
                            { kind: "charge", turns: 1 },
                            { kind: "protect", turns: 1 },
                          ]
                        : [],
                    }
                  : entry
              ),
            },
          })
          if (issue) throw issue
          await runtime.advance(withStatuses ? 9001 : 11001)
          const weapon = game.queries.member(game.state, member)!.weapon!
          return {
            save: JSON.stringify(game.save()),
            name: weapon.name + (weapon.plus ? `+${weapon.plus}` : ""),
            short: weapon.short,
            memberName: game.queries.member(game.state, member)!.name,
          }
        },
        {
          withStatuses,
          sword: goods.find((entry) => entry.slug === "sword")!.id,
          shop: shops.find((entry) => entry.slug === "armory")!.id,
        }
      )
      await page
        .locator(`.card .hit[aria-label^="${expected.memberName} HP"]`)
        .click()
      await page.evaluate(async (withStatuses) => {
        await window.__devStudio!.advance(withStatuses ? 10500 : 12500)
      }, withStatuses)
      const peek = page.locator(".peek")
      await peek.waitFor({ state: "visible" })
      if (
        (await peek.locator("[data-member-armor-broken]").count()) !==
        (withStatuses ? 1 : 0)
      )
        throw new Error("戦闘の耐久切れ表示が違う")
      const weaponName = peek.locator("[data-member-weapon-name]")
      const shortage = peek.locator("[data-member-weapon-short]")
      if (withStatuses) {
        const text = `筋力が${expected.short.str}足りない・技量が${expected.short.tec}足りない`
        if ((await shortage.innerText()) !== text)
          throw new Error("両能力不足が欠ける")
      } else if (await shortage.count()) {
        throw new Error("能力を満たしても警告が残る")
      }
      if ((await weaponName.innerText()) !== expected.name)
        throw new Error("戦闘詳細の強化段階が違う")
      const bounds = await weaponName.boundingBox()
      if (
        !bounds ||
        bounds.x < 0 ||
        bounds.x + bounds.width > viewport.width ||
        bounds.y < 0 ||
        bounds.y + bounds.height > viewport.height
      )
        throw new Error("武器名が画面外")
      if (withStatuses) {
        const labels = {
          poison: "毒：残り3手番",
          bind: "縛り：残り2手番",
          regen: "再生：残り4手番",
          taunt: "挑発：残り2手番",
          charge: "溜め：使うまで有効",
          protect: "守り：使うまで有効",
        }
        for (const [kind, text] of Object.entries(labels)) {
          const label = peek.locator(`[data-member-status="${kind}"]`)
          if ((await label.innerText()) !== text)
            throw new Error(`状態の説明が違う: ${kind}`)
          const bounds = await label.boundingBox()
          if (
            !bounds ||
            bounds.x < 0 ||
            bounds.x + bounds.width > viewport.width ||
            bounds.y < 0 ||
            bounds.y + bounds.height > viewport.height
          )
            throw new Error(`状態が画面外: ${kind}`)
        }
      } else {
        if ((await peek.locator("[data-member-status]").count()) !== 0)
          throw new Error("解除した状態が残る")
        if (!(await peek.innerText()).includes("状態異常なし"))
          throw new Error("状態なしを表示しない")
      }
      await page.screenshot({
        path: `/tmp/dnd-member-weapon-plus-${viewport.name}-${withStatuses ? "all" : "none"}.png`,
      })
      await peek.click({ position: { x: 10, y: 10 } })
      if (await page.locator(".peek").count())
        throw new Error("詳細を閉じられない")
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== expected.save
      )
        throw new Error("状態の閲覧で保存が変わる")
      console.log(
        `${viewport.name}/${withStatuses ? "6状態" : "状態なし"}: 表示・開閉・保存保持`
      )
    }
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
