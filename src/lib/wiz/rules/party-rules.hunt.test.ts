import { describe, expect, it } from "vite-plus/test"
import {
  aState,
  contentId,
  demonBySlug,
  goodBySlug,
  memberBySlug,
  realContent,
  realSmithy,
  seededRandom,
  skillBySlug,
} from "@/lib/wiz/testing"
import { GameCatalog, PartyRules, type GameState } from "@/lib/wiz"
import type { Member } from "@/lib/wiz/state"

/** 仲間の能力・成長・使用回数（PartyRules）の境界をさがす。 */
describe("仲間の能力と成長の不変条件", () => {
  const catalog = new GameCatalog(realContent())
  const rules = new PartyRules(catalog)
  // 武器のワザを測るので、アルダには鉄の両手剣を持たせておく
  const base = aState().withEquipped("alda", "greatsword").build()
  const memberOf = (state: GameState, id: string) =>
    state.members.find((member) => member.id === id)!
  const idOf = (slug: string) => memberBySlug(slug).id
  const greatsword = goodBySlug("greatsword")
  // 鉄の両手剣に付く武器のワザと、アルダ自身のワザ
  const weaponSkill = skillBySlug("whirl")
  const otherWeaponSkill = skillBySlug("charge")
  const ownSkill = skillBySlug("focus")
  const brawl = contentId("brawl")

  it("[feature:W020] 並びの左2人が前衛、右1人が後衛。控えは列を持たない", () => {
    expect(base.party).toEqual(["hero", "alda", "mort"].map(idOf))
    expect(rules.rowOf(base, base.party[0])).toBe("front")
    expect(rules.rowOf(base, base.party[1])).toBe("front")
    expect(rules.rowOf(base, base.party[2])).toBe("back")
    expect(rules.rowOf(base, idOf("jig"))).toBeNull()
  })

  it("[feature:W004] 後衛の近接だけ威力が下がる", () => {
    const melee = realContent().balance.backRow.melee
    const [front, , back] = base.party
    expect(rules.reachFactor(base, back, "melee")).toBe(melee)
    expect(rules.reachFactor(base, back, "ranged")).toBe(1)
    expect(rules.reachFactor(base, front, "melee")).toBe(1)
    // 控えは列がないので下がらない
    expect(rules.reachFactor(base, idOf("jig"), "melee")).toBe(1)
  })

  it("[feature:W017] 必要な能力の倍率は0〜1に収まり、必要0なら下がらない", () => {
    const floor = realContent().balance.weapon.needFloor
    expect(
      rules.equipment.requirementFactor({ str: 0, tec: 0 }, { str: 0, tec: 0 })
    ).toBe(1)
    expect(
      rules.equipment.requirementFactor(
        { str: 0, tec: 0 },
        { str: 10, tec: 10 }
      )
    ).toBe(floor * floor)
    expect(
      rules.equipment.requirementFactor(
        { str: 99, tec: 99 },
        { str: 10, tec: 4 }
      )
    ).toBe(1)
    for (const str of [1, 5, 9, 10, 20]) {
      const factor = rules.equipment.requirementFactor(
        { str, tec: 9 },
        { str: 10, tec: 0 }
      )
      expect(factor).toBeGreaterThanOrEqual(floor)
      expect(factor).toBeLessThanOrEqual(1)
    }
  })

  it("[feature:W017] 攻撃力は1より下がらない", () => {
    const weak = {
      ...base,
      members: base.members.map((member) => ({
        ...member,
        stats: { ...member.stats, str: 0, tec: 0 },
      })),
    } as GameState
    for (const member of weak.members)
      expect(rules.attack(member, weak)).toBeGreaterThanOrEqual(1)
  })

  it("[feature:W023] 防具の最大の耐久は強化の段だけ増え、武器は0のまま", () => {
    const per = realContent().balance.armor.durabilityPerPlus
    const leather = goodBySlug("leather")
    for (const plus of [0, 1, 2, 5])
      expect(
        rules.equipment.maxDurabilityOf(catalog.good(leather.id)!, plus)
      ).toBe(leather.durability! + plus * per)
    expect(
      rules.equipment.maxDurabilityOf(catalog.good(goodBySlug("sword").id)!, 2)
    ).toBe(0)
  })

  it("[feature:W025] 修理の費用は減った分の切り上げで、減っていなければ0", () => {
    expect(rules.equipment.repairCost(0)).toBe(0)
    expect(rules.equipment.repairCost(-5)).toBe(0)
    expect(rules.equipment.repairCost(1)).toBe(1)
    expect(rules.equipment.repairCost(3)).toBe(2)
    expect(rules.equipment.repairCost(10)).toBe(5)
  })

  it("[feature:W004] 使用回数は強化の段で増え、素の武器と固有スキルは増えない", () => {
    const per = realContent().balance.weapon.usesPerPlus
    const plus = 4
    const gear = base.gear.map((entry) =>
      entry.owner === idOf("alda") && entry.good === greatsword.id
        ? { ...entry, plus }
        : entry
    )
    const upgraded = { ...base, gear } as GameState
    const alda = memberOf(upgraded, idOf("alda"))
    // 武器のワザは段の分だけ増える
    expect(rules.skills.maxUses(alda, upgraded, weaponSkill.id)).toBe(
      weaponSkill.uses! + Math.floor(plus / per)
    )
    // キャラ固有のスキルは増えない
    expect(rules.skills.maxUses(alda, upgraded, ownSkill.id)).toBe(
      ownSkill.uses
    )
    // 使用回数のないワザは無制限のまま
    expect(rules.skills.maxUses(alda, upgraded, brawl)).toBeNull()
    for (const step of [0, 1, 2, 3, 4, 5])
      expect(rules.skills.usesBonus(step)).toBe(Math.floor(step / per))
    // 武器を持たない（素の武器の）仲間は段が付かない
    const bare = aState().build()
    const mort = memberOf(bare, idOf("mort"))
    expect(rules.skills.maxUses(mort, bare, weaponSkill.id)).toBe(
      weaponSkill.uses
    )
  })

  it("[feature:W004] 残りの使用回数は0より下がらず、最大を超えない", () => {
    const alda: Member = {
      ...memberOf(base, idOf("alda")),
      used: [{ skill: weaponSkill.id, count: 99 }],
    }
    expect(rules.skills.leftOf(alda, base, weaponSkill.id)).toBe(0)
    expect(rules.skills.leftOf(alda, base, otherWeaponSkill.id)).toBe(
      otherWeaponSkill.uses
    )
    expect(rules.skills.leftOf(alda, base, brawl)).toBeNull()
    const fresh = memberOf(base, idOf("alda"))
    expect(rules.skills.leftOf(fresh, base, weaponSkill.id)).toBe(
      weaponSkill.uses
    )
  })

  it("[feature:W004] 使った記録は無制限のワザには残らず、同じワザは数が増える", () => {
    const alda = memberOf(base, idOf("alda"))
    expect(rules.skills.spendUse(alda, brawl)).toEqual([])
    const once = rules.skills.spendUse(alda, weaponSkill.id)
    expect(once).toEqual([{ skill: weaponSkill.id, count: 1 }])
    const twice = rules.skills.spendUse({ ...alda, used: once }, weaponSkill.id)
    expect(twice).toEqual([{ skill: weaponSkill.id, count: 2 }])
    const other = rules.skills.spendUse(
      { ...alda, used: twice },
      otherWeaponSkill.id
    )
    expect(other).toEqual([
      { skill: weaponSkill.id, count: 2 },
      { skill: otherWeaponSkill.id, count: 1 },
    ])
  })

  it("[feature:W021] 使用回数を戻すと0未満にならず、戻した数が合う", () => {
    const alda: Member = {
      ...memberOf(base, idOf("alda")),
      used: [
        { skill: weaponSkill.id, count: 1 },
        { skill: otherWeaponSkill.id, count: 3 },
      ],
    }
    const restored = rules.skills.refillUses(alda, 2)
    expect(restored).toEqual({
      used: [{ skill: otherWeaponSkill.id, count: 1 }],
      restored: 3,
    })
    expect(rules.skills.refillUses(alda, 0)).toEqual({
      used: alda.used,
      restored: 0,
    })
    expect(rules.skills.refillUses(alda, 99).used).toEqual([])
    expect(rules.skills.refillUses({ ...alda, used: [] }, 2).restored).toBe(0)
  })

  it("[feature:W004] 攻撃できるワザが残り0のときだけ殴れる（境界）", () => {
    const ada = memberOf(base, idOf("alda"))
    const hits = rules.skills
      .battleSkills(ada, base)
      .filter((id) => catalog.skill(id)?.kind === "hit")
    expect(hits.length).toBeGreaterThan(0)
    const spent = hits.map((skill) => ({
      skill,
      count: rules.skills.maxUses(ada, base, skill) ?? 0,
    }))
    expect(rules.skills.canBrawl({ ...ada, used: spent }, base)).toBe(true)
    // 一つでも残っていれば殴れない
    const oneLeft = spent.map((entry, index) =>
      index === 0 ? { ...entry, count: entry.count - 1 } : entry
    )
    expect(rules.skills.canBrawl({ ...ada, used: oneLeft }, base)).toBe(false)
    expect(rules.skills.canBrawl(ada, base)).toBe(false)
  })

  it("[feature:W007] 次のレベルまでの経験値はレベル×expBase", () => {
    const { expBase, expPower } = realContent().balance
    for (const lv of [1, 2, 3, 10, 25])
      expect(rules.growth.expToNext(lv)).toBe(
        Math.max(1, Math.round(expBase * lv ** expPower))
      )
  })

  it("[feature:W007] 経験値がちょうど足りるとレベルが1つ上がり、余りは残る", () => {
    const ada = memberOf(base, idOf("alda"))
    const need = rules.growth.expToNext(ada.lv)
    expect(rules.growth.grow({ ...ada, exp: need - 1 }, () => 0.99)).toEqual({
      ...ada,
      exp: need - 1,
    })
    const grown = rules.growth.grow({ ...ada, exp: need }, () => 0.99)
    expect(grown.lv).toBe(ada.lv + 1)
    expect(grown.exp).toBe(0)
    const extra = rules.growth.grow({ ...ada, exp: need + 5 }, () => 0.99)
    expect(extra.lv).toBe(ada.lv + 1)
    expect(extra.exp).toBe(5)
  })

  it("[feature:W007] 経験値がたくさんあると一度に何段でも上がる", () => {
    const ada = memberOf(base, idOf("alda"))
    const grown = rules.growth.grow({ ...ada, exp: 1000 }, () => 0.99)
    expect(grown.lv).toBeGreaterThan(ada.lv + 3)
    expect(grown.exp).toBeLessThan(rules.growth.expToNext(grown.lv))
    expect(grown.stats.maxHp).toBeGreaterThan(ada.stats.maxHp)
  })

  it("[feature:W007] 速さは確率で伸びる（乱数0なら毎回、0.99なら伸びない）", () => {
    const ada = memberOf(base, idOf("alda"))
    const always = rules.growth.grow({ ...ada, exp: 1000 }, () => 0)
    const never = rules.growth.grow({ ...ada, exp: 1000 }, () => 0.99)
    expect(always.stats.spd).toBe(ada.stats.spd + (always.lv - ada.lv))
    expect(never.stats.spd).toBe(ada.stats.spd)
    expect(always.lv).toBe(never.lv)
  })

  it("[feature:W007] どの成長の型でも能力は減らず、レベルは飛ばない", () => {
    for (const slug of ["alda", "jig", "tsumugi", "alma", "luca"]) {
      const id = idOf(slug)
      const def = catalog.member(id)!
      let member: Member = {
        id,
        lv: def.lv,
        exp: 0,
        hp: def.stats.maxHp,
        stats: { ...def.stats },
        used: [],
        status: [],
        fatigue: 0,
        dirt: 0,
        like: 0,
      }
      const random = seededRandom(3)
      for (let step = 0; step < 30; step++) {
        const before = member
        member = rules.growth.grow(
          { ...member, exp: member.exp + rules.growth.expToNext(member.lv) },
          random
        )
        expect(member.lv).toBe(before.lv + 1)
        expect(member.stats.maxHp).toBeGreaterThanOrEqual(before.stats.maxHp)
        expect(member.stats.str).toBeGreaterThanOrEqual(before.stats.str)
        expect(member.stats.tec).toBeGreaterThanOrEqual(before.stats.tec)
        expect(member.stats.spd).toBeGreaterThanOrEqual(before.stats.spd)
        expect(member.exp).toBeLessThan(rules.growth.expToNext(member.lv))
      }
    }
  })

  it("[feature:W007] 1レベルごとの伸びを足すと、積み上げた合計と食い違わない", () => {
    for (const definition of [
      ...catalog.data.party,
      ...catalog.data.recruits
        .filter((entry) => !entry.retired)
        .map((entry) => entry.member),
    ]) {
      const id = definition.id
      const growth = definition.growth ?? catalog.data.balance.growth
      const from = definition.lv
      let sum = 0
      let expected = 0
      for (let lv = from; lv < from + 25; lv++) {
        sum += rules.growth.growthGain({ id }, lv).maxHp
        expected += growth.maxHp * rules.growth.growthFactor({ id }, lv)
      }
      // 端数は積み上げてから切り捨てるので、合計の差は1未満
      expect(Math.abs(sum - Math.floor(expected))).toBeLessThanOrEqual(1)
    }
  })

  it("[feature:W007] 控えめの型は普通の型より伸びが小さい", () => {
    const source = realContent()
    const modestRules = new PartyRules(
      new GameCatalog({
        ...source,
        recruits: source.recruits.map((entry) =>
          entry.member.id === idOf("husky")
            ? {
                ...entry,
                member: { ...entry.member, growthType: "modest" as const },
              }
            : entry
        ),
      })
    )
    const total = (slug: string) => {
      const id = idOf(slug)
      const from = catalog.member(id)!.lv
      let sum = 0
      for (let lv = from; lv < from + 20; lv++)
        sum += modestRules.growth.growthGain({ id }, lv).maxHp
      return sum
    }
    expect(total("husky")).toBeLessThan(total("alda"))
    expect(rules.growth.growthTypeOf({ id: "no-such-member" })).toBe("normal")
  })

  it("[feature:W026] ユニークの固有の武器だけ段の上限が高い", () => {
    const { maxPlus } = realContent().balance.unique
    const upgrades = realSmithy().upgrades.length
    expect(rules.equipment.isUnique({ id: idOf("husky") })).toBe(true)
    // 悪魔と契約して戦う仲間（R）はユニークではない
    expect(rules.equipment.isUnique({ id: idOf("alma") })).toBe(false)
    expect(rules.equipment.isUnique({ id: idOf("alda") })).toBe(false)
    expect(
      rules.equipment.isFixedWeapon({
        good: contentId("iron-gloves"),
        owner: contentId("husky"),
      })
    ).toBe(true)
    expect(
      rules.equipment.isFixedWeapon({
        good: contentId("leather"),
        owner: contentId("husky"),
      })
    ).toBe(false)
    expect(
      rules.equipment.isFixedWeapon({
        good: contentId("iron-gloves"),
        owner: null,
      })
    ).toBe(false)
    expect(
      rules.equipment.maxPlusOf({
        good: contentId("iron-gloves"),
        owner: contentId("husky"),
      })
    ).toBe(maxPlus)
    expect(
      rules.equipment.maxPlusOf({
        good: contentId("greatsword"),
        owner: contentId("alda"),
      })
    ).toBe(upgrades)
  })

  it("[feature:W013] 主人公のワザは契約している悪魔のもので、悪魔のレベルで威力が上がる", () => {
    expect(rules.magic.skills({ id: idOf("hero") }, base)).toEqual(
      demonBySlug("nui").skills
    )
    expect(rules.magic.skills({ id: idOf("alda") }, base)).toEqual(
      memberBySlug("alda").skills
    )
    const per = realContent().summon.powerPerLevel
    expect(rules.magic.demonPower(base)).toBe(1)
    const leveled = aState()
      .withDemons([{ id: "nui", lv: 3, exp: 0 }])
      .build()
    expect(rules.magic.demonPower(leveled)).toBe(1 + per * 2)
  })
})
