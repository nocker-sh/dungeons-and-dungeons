import { describe, expect, it } from "vite-plus/test"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { foeBySlug } from "@/lib/wiz/testing/foe-by-slug"
import { seededRandom } from "@/lib/wiz/testing/seeded-random"
import { BattleRules } from "@/lib/wiz/rules/battle-rules"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { PartyRules } from "@/lib/wiz/rules/party-rules"
import type { GameContent } from "@/lib/wiz/content/content-schema"
import type { Member } from "@/lib/wiz/state/state-schema"

/** データから戦闘の計算だけを取り出す。 */
function rulesOf(content: GameContent) {
  const catalog = new GameCatalog(content)
  return new BattleRules(catalog, new PartyRules(catalog))
}

/** 出撃の並び順の仲間（前衛2人・後衛1人）。主人公・アルダ（タンク）・モート。 */
function partyMembers(content: GameContent): Member[] {
  const state = aState(content).build()
  return state.party.map((id) =>
    state.members.find((member) => member.id === id)!
  )
}

describe("戦闘の計算（hunt）", () => {
  const content = aContent().build()

  it("[feature:W004] 被害は攻撃力×威力の振れ幅の内側に収まり、必ず1以上", () => {
    const rules = rulesOf(content)
    const { swing } = content.balance.damage
    for (let seed = 1; seed <= 60; seed++) {
      const random = seededRandom(seed)
      for (const [attack, power] of [
        [1, 0.1],
        [12, 1.2],
        [80, 1.8],
        [0, 1],
      ]) {
        const damage = rules.damage(attack, power, random)
        expect(damage).toBeGreaterThanOrEqual(1)
        expect(damage).toBeGreaterThanOrEqual(
          Math.min(1, Math.round(attack * power * swing[0]))
        )
        expect(damage).toBeLessThanOrEqual(
          Math.max(1, Math.round(attack * power * swing[1]))
        )
      }
    }
  })

  it("[feature:W004] 回復は (base+攻撃力)×威力 の振れ幅の内側に収まり、必ず1以上", () => {
    const rules = rulesOf(content)
    const { base, swing } = content.balance.heal
    for (let seed = 1; seed <= 60; seed++) {
      const random = seededRandom(seed)
      for (const [attack, power] of [
        [0, 0.1],
        [12, 1.6],
        [40, 2],
      ]) {
        const heal = rules.heal(attack, power, random)
        expect(heal).toBeGreaterThanOrEqual(1)
        expect(heal).toBeLessThanOrEqual(
          Math.max(1, Math.round((base + attack) * power * swing[1]))
        )
      }
    }
  })

  it("[feature:W005] 毒で失うHPは最大HPの割で、最大HPが小さくても1以上", () => {
    const rules = rulesOf(content)
    const divisor = content.balance.poisonDivisor
    for (const maxHp of [1, 2, 9, 10, 11, 128, 1400]) {
      const amount = rules.poison(maxHp)
      expect(amount).toBeGreaterThanOrEqual(1)
      expect(amount).toBe(Math.max(1, Math.floor(maxHp / divisor)))
      expect(amount).toBeLessThanOrEqual(Math.max(1, maxHp))
    }
  })

  it("[feature:W005] 被害の振り分けは合計が変わらず、耐久もHPも負にならない", () => {
    for (const amount of [0, 1, 7, 40, 999]) {
      for (const durability of [-5, 0, 1, 7, 40, 999]) {
        const split = BattleRules.split(amount, durability)
        expect(split.armor + split.hp).toBe(amount)
        expect(split.armor).toBeGreaterThanOrEqual(0)
        expect(split.hp).toBeGreaterThanOrEqual(0)
        expect(split.armor).toBeLessThanOrEqual(Math.max(0, durability))
      }
    }
  })

  it("[feature:W004] 行動順は出撃の4人と敵をちょうど一度ずつ並べる", () => {
    const rules = rulesOf(content)
    const state = aState(content).build()
    const foes = [foeBySlug("kamokutsu"), foeBySlug("koburakuda")].map(
      (foe, index) => ({
        id: `foe-${index + 1}`,
        foe: foe.id,
        hp: foe.hp,
        maxHp: foe.hp,
        status: [],
      })
    )
    const order = rules.order(state, foes)
    expect(order).toHaveLength(state.party.length + foes.length)
    expect(new Set(order.map((ref) => ref.id)).size).toBe(order.length)
    for (const id of state.party)
      expect(order.some((ref) => ref.kind === "member" && ref.id === id)).toBe(
        true
      )
    // 控えの仲間は並ばない
    const reserves = state.members.filter(
      (member) => !state.party.includes(member.id)
    )
    for (const member of reserves)
      expect(order.some((ref) => ref.id === member.id)).toBe(false)
  })

  it("[feature:W004] 行動順は速さの降順で、同じ速さなら仲間が先", () => {
    const rules = rulesOf(content)
    const kamokutsu = foeBySlug("kamokutsu")
    const foeOf = () => ({
      id: "foe-1",
      foe: kamokutsu.id,
      hp: kamokutsu.hp,
      maxHp: kamokutsu.hp,
      status: [],
    })
    // 全員と敵の速さを同じにすると、仲間が並びの順で先に来る
    const same = aContent(content)
      .withFoe("kamokutsu", { spd: kamokutsu.spd })
      .build()
    const evenState = aState(same)
      .withMembers((member) => ({
        stats: { ...member.stats, spd: kamokutsu.spd },
      }))
      .build()
    const order = rulesOf(same).order(evenState, [foeOf()])
    expect(order.map((ref) => ref.id)).toEqual([...evenState.party, "foe-1"])
    // 速さが違えば降順
    const state = aState(content).build()
    const plain = rules.order(state, [foeOf()])
    const speeds = plain.map((ref) =>
      ref.kind === "foe"
        ? kamokutsu.spd
        : (state.members.find((member) => member.id === ref.id)?.stats.spd ?? 0)
    )
    expect(speeds).toEqual([...speeds].toSorted((a, b) => b - a))
  })

  it("[feature:W005] 敵の近接は前衛だけを狙い、前衛のタンクほど狙われる", () => {
    const rules = rulesOf(content)
    const members = partyMembers(content)
    const hits = new Map<string, number>()
    const random = seededRandom(7)
    for (let round = 0; round < 400; round++) {
      const target = rules.target(members, random, "melee")!
      hits.set(target.id, (hits.get(target.id) ?? 0) + 1)
    }
    expect(hits.get(members[2].id)).toBeUndefined()
    expect(hits.get(members[0].id)).toBeGreaterThan(40)
    // タンクのアルダ（重み tankTarget）は主人公（重み1）より狙われる
    expect(content.balance.tankTarget).toBeGreaterThan(1)
    expect(hits.get(members[1].id)!).toBeGreaterThan(
      hits.get(members[0].id)! * 2
    )
  })

  it("[feature:W005] 前衛が全員倒れたら、近接も後衛を狙う", () => {
    const rules = rulesOf(content)
    const members = partyMembers(content).map((member, index) =>
      index < 2 ? { ...member, hp: 0 } : member
    )
    const picked = new Set<string>()
    const random = seededRandom(3)
    for (let round = 0; round < 60; round++)
      picked.add(rules.target(members, random, "melee")!.id)
    expect([...picked]).toEqual([members[2].id])
  })

  it("[feature:W005] 敵の遠距離は後衛にも届き、前衛のタンクがいちばん狙われる", () => {
    const rules = rulesOf(content)
    const members = partyMembers(content)
    const hits = new Map<string, number>()
    const random = seededRandom(11)
    for (let round = 0; round < 500; round++) {
      const target = rules.target(members, random, "ranged")!
      hits.set(target.id, (hits.get(target.id) ?? 0) + 1)
    }
    for (const member of members)
      expect(hits.get(member.id)).toBeGreaterThan(40)
    expect(hits.get(members[1].id)!).toBeGreaterThan(hits.get(members[0].id)!)
    expect(hits.get(members[1].id)!).toBeGreaterThan(hits.get(members[2].id)!)
    // 届く相手：近接は前衛だけ、遠距離は全員
    expect(
      rules.reachable(members, "melee").map((entry) => entry.member.id)
    ).toEqual([members[0].id, members[1].id])
    expect(
      rules.reachable(members, "ranged").map((entry) => entry.member.id)
    ).toEqual(members.map((member) => member.id))
  })

  it("[feature:W005] 挑発している仲間がいれば、後衛でも近接で狙われる", () => {
    const rules = rulesOf(content)
    const members = partyMembers(content).map((member, index) =>
      index === 2
        ? { ...member, status: [{ kind: "taunt" as const, turns: 2 }] }
        : member
    )
    const random = seededRandom(5)
    for (let round = 0; round < 20; round++)
      expect(rules.target(members, random, "melee")!.id).toBe(members[2].id)
  })

  it("[feature:W005] 敵の遠距離は後衛に backRow.hit の確率で当たり、前衛と近接は必ず当たる", () => {
    const rules = rulesOf(content)
    const { hit } = content.balance.backRow
    expect(hit).toBeGreaterThan(0)
    expect(hit).toBeLessThan(1)
    // 乱数が確率の境目より下なら当たり、以上なら外れる
    expect(rules.hits("back", "ranged", () => hit - 0.001)).toBe(true)
    expect(rules.hits("back", "ranged", () => hit)).toBe(false)
    let drawn = 0
    const counting = () => {
      drawn++
      return 0.999
    }
    expect(rules.hits("front", "ranged", counting)).toBe(true)
    expect(rules.hits("back", "melee", counting)).toBe(true)
    expect(rules.hits(null, "ranged", counting)).toBe(true)
    // 必ず当たるときは乱数を使わない（乱数の並びを変えない）
    expect(drawn).toBe(0)
    const random = seededRandom(13)
    let landed = 0
    const tries = 2000
    for (let round = 0; round < tries; round++)
      if (rules.hits("back", "ranged", random)) landed++
    expect(landed / tries).toBeGreaterThan(hit - 0.05)
    expect(landed / tries).toBeLessThan(hit + 0.05)
  })

  it("[feature:W005] 全員倒れていれば狙う相手はいない", () => {
    const rules = rulesOf(content)
    const members = partyMembers(content).map((member) => ({
      ...member,
      hp: 0,
    }))
    expect(rules.target(members, seededRandom(1))).toBeNull()
    expect(rules.target([], seededRandom(1))).toBeNull()
  })

  it("[feature:W005] 狙いは乱数が端でも生きている仲間から外れない", () => {
    const rules = rulesOf(content)
    const members = partyMembers(content)
    for (const value of [0, 0.999999, 1]) {
      const target = rules.target(members, () => value)!
      expect(members.some((member) => member.id === target.id)).toBe(true)
      expect(target.hp).toBeGreaterThan(0)
    }
  })
})
