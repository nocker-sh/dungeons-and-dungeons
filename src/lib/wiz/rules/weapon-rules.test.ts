import { describe, expect, it } from "vite-plus/test"
import {
  aState,
  contentId,
  createTestGame,
  eventsOrThrow,
  goodBySlug,
  memberBySlug,
  realContent,
  seededRandom,
  sequenceRandom,
} from "@/lib/wiz/testing"
import {
  GameCatalog,
  GameCommandError,
  PartyRules,
  WeaponRules,
} from "@/lib/wiz"
import { baseSellPrice } from "@/lib/wiz/rules"

describe("武器の個体（レア度）", () => {
  const catalog = new GameCatalog(realContent())
  const weapons = new WeaponRules(catalog)
  const greatsword = goodBySlug("greatsword")
  const table = realContent().balance.weapon.rarity
  const alda = memberBySlug("alda").id

  /** 決めた順番の乱数で回すプレイ（尽きたら0）。ガラクタと素材は袋に入れておく。 */
  function scripted(rolls: readonly number[]) {
    return createTestGame({
      random: sequenceRandom(rolls),
      state: aState().withItem("junk", 3).withItem("bone", 2).build(),
    })
  }

  /**
   * SR の鉄の両手剣が出る乱数の並び。
   * 0 → 鑑定の品は鑑定の表の先頭（鉄の両手剣）、0.99 → SR、0.5 → 上振れ、残りは候補のワザ。
   */
  const superRare = [0, 0.99, 0.5, 0.2, 0.9]

  it("[feature:W010] 鑑定はレア度・攻撃力の上振れ・ランダムなワザを一度に引く", () => {
    const game = scripted(superRare)
    const events = eventsOrThrow(
      game.send({ type: "appraise", shop: contentId("armory") })
    )
    expect(events).toEqual([
      {
        type: "appraised",
        good: greatsword.id,
        gear: "id-1",
        rarity: "SR",
      },
    ])
    const individual = game.state.gear.find(
      (gear) => gear.id === "id-1"
    )?.weapon
    expect(individual?.rarity).toBe("SR")
    const [least, most] = table.powerRate.SR
    const power = greatsword.power ?? 0
    expect(individual?.extraPower).toBeGreaterThanOrEqual(
      Math.round(power * least)
    )
    expect(individual?.extraPower).toBeLessThanOrEqual(Math.round(power * most))
    expect(individual?.skills.slice(0, 1)).toEqual(
      greatsword.skills!.slice(0, 1)
    )
    expect(new Set(individual!.skills).size).toBe(3)
    const changed = individual!.skills.slice(1)
    expect(changed).toHaveLength(table.randomSkills.SR)
    for (const id of changed) expect(weapons.pool(greatsword)).toContain(id)
  })

  it("[feature:W010] レア度は balance の重みどおりに散らばる", () => {
    const random = seededRandom(7)
    const counts = { N: 0, R: 0, SR: 0 }
    const runs = 4000
    for (let run = 0; run < runs; run++) counts[weapons.rollRarity(random)] += 1
    const total = table.weights.N + table.weights.R + table.weights.SR
    for (const rarity of ["N", "R", "SR"] as const)
      expect(
        Math.abs(counts[rarity] / runs - table.weights[rarity] / total)
      ).toBeLessThan(0.03)
  })

  it("ランダムなワザは全レア度で2つ入り、3つが重ならない", () => {
    const random = seededRandom(3)
    const definition = catalog.good(greatsword.id)!
    const fixed = definition.skills!.slice(0, 1)
    for (const rarity of ["N", "R", "SR"] as const)
      for (let run = 0; run < 50; run++) {
        const skills = weapons.rollSkills(definition, rarity, random)
        expect(skills).toHaveLength(3)
        expect(new Set(skills).size).toBe(3)
        expect(skills.slice(0, 1)).toEqual(fixed)
        const changed = skills.slice(1)
        expect(changed).toHaveLength(table.randomSkills[rarity])
        for (const id of changed) expect(weapons.pool(greatsword)).toContain(id)
      }
  })

  it("上振れは武器の攻撃力に対するレア度ごとの割合に収まる", () => {
    const random = seededRandom(11)
    const power = greatsword.power ?? 0
    for (const rarity of ["N", "R", "SR"] as const)
      for (let run = 0; run < 100; run++) {
        const extra = weapons.rollExtraPower(greatsword, rarity, random)
        expect(extra).toBeGreaterThanOrEqual(
          Math.round(power * table.powerRate[rarity][0])
        )
        expect(extra).toBeLessThanOrEqual(
          Math.round(power * table.powerRate[rarity][1])
        )
      }
  })

  it("R・SR の武器は装備するとそのワザの最大の使用回数が増える", () => {
    const parties = new PartyRules(catalog)
    const skill = greatsword.skills![0]
    const base = parties.skills.baseUses(skill)!
    for (const rarity of ["N", "R", "SR"] as const) {
      const state = aState()
        .withEquipped("alda", "greatsword", {
          weapon: { rarity, extraPower: 0, skills: [...greatsword.skills!] },
        })
        .build()
      expect(parties.skills.maxUses({ id: alda }, state, skill)).toBe(
        base + table.uses[rarity]
      )
    }
  })

  it("[feature:W024] 鍛冶屋で作った武器も N・上振れなし・2枠を抽選する", () => {
    // 道具屋から燃えカスを買って作る
    const game = createTestGame({
      random: 0.99,
      state: aState().withGold(1000).withItem("bone", 2).build(),
    })
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("tools"),
        good: contentId("cinder"),
      })
    )
    eventsOrThrow(game.send({ type: "craft", recipe: contentId("craft-axe") }))
    const axe = goodBySlug("axe")
    const made = game.state.gear.find((gear) => gear.good === axe.id)!
    expect(made.weapon).toEqual({
      rarity: "N",
      extraPower: 0,
      skills: weapons.rollSkills(axe, "N", () => 0.99),
    })
  })

  it("武器を装備していない仲間の素の武器も N・上振れなし", () => {
    const state = aState().build()
    const rules = new PartyRules(catalog)
    const hero = memberBySlug("hero")
    const weapon = rules.equipment.weaponOf({ id: hero.id }, state)
    expect(weapon?.equipped).toBe(false)
    expect(weapon?.gear).toBe(null)
    expect(weapon?.individual).toEqual({
      rarity: "N",
      extraPower: 0,
      skills: catalog.good(hero.defaultWeapon)!.skills,
    })
  })

  it("[feature:W004] 戦闘の指示に並ぶのは、その個体に付いた3つのワザ", () => {
    const game = scripted(superRare)
    eventsOrThrow(game.send({ type: "appraise", shop: contentId("armory") }))
    eventsOrThrow(game.send({ type: "equip", gear: "id-1", member: alda }))
    const individual = game.state.gear.find(
      (gear) => gear.id === "id-1"
    )!.weapon!
    const base = game.queries.weaponFit(game.state, alda, greatsword.id)!
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    const commands = game.queries.commands(game.state, alda)!
    expect(commands.weaponSkills.map((skill) => skill.id)).toEqual(
      individual.skills
    )
    // ランダムに入ったワザには印が付く
    expect(commands.weaponSkills.map((skill) => skill.random)).toEqual([
      false,
      true,
      true,
    ])
    expect(commands.weapon?.rarity).toBe("SR")
    expect(commands.weapon?.extraPower).toBe(individual.extraPower)
    // 上振れの分だけ攻撃力が上がる
    expect(commands.weapon!.attack).toBeGreaterThan(base.attack)
    // アルダの手番まで進める
    for (let guard = 0; guard < 8; guard++) {
      const view = game.queries.battle(game.state)!
      if (view.current.id === alda) break
      eventsOrThrow(
        view.current.kind === "foe"
          ? game.send({ type: "foe-turn" })
          : game.send({ type: "act", command: "guard" })
      )
    }
    // 個体から外れた武器のワザは使えない
    const dropped = greatsword.skills!.find(
      (id) => !individual.skills.includes(id)
    )!
    expect(
      (
        game.send({
          type: "act",
          command: "skill",
          skill: dropped,
        }) as GameCommandError
      ).code
    ).toBe("UNAVAILABLE")
    // 個体に入ったワザは使える
    const added = individual.skills.at(-1)!
    eventsOrThrow(game.send({ type: "act", command: "skill", skill: added }))
  })

  it("[feature:W009] レア度の高い武器は高く売れる", () => {
    const game = scripted(superRare)
    eventsOrThrow(game.send({ type: "appraise", shop: contentId("armory") }))
    const gold = game.state.gold
    // 元の売値（値段の半分）に SR の倍率
    const price = Math.round(baseSellPrice(greatsword) * table.sell.SR)
    expect(
      game.queries.gear(game.state).find((entry) => entry.gear === "id-1")
        ?.price
    ).toBe(price)
    eventsOrThrow(game.send({ type: "sell", gear: "id-1" }))
    expect(game.state.gold).toBe(gold + price)
  })
})
