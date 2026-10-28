import { describe, expect, it } from "vite-plus/test"
import { stateSchema } from "@/lib/wiz/state/state-schema"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"

const base = aState().withEquipped("alda", "greatsword").build()

function accepts(patch: Record<string, unknown>) {
  return stateSchema.safeParse({ ...base, ...patch }).success
}

function member(patch: Record<string, unknown>) {
  return accepts({
    members: base.members.map((entry, index) =>
      index === 0 ? { ...entry, ...patch } : entry
    ),
  })
}

function gear(patch: Record<string, unknown>) {
  const weapon = base.gear.findIndex((entry) => entry.weapon)
  return accepts({
    gear: base.gear.map((entry, index) =>
      index === weapon ? { ...entry, ...patch } : entry
    ),
  })
}

describe("保存する状態の形の境目（hunt）", () => {
  it("はじめからの状態は通り、往復しても同じ", () => {
    const parsed = stateSchema.parse(JSON.parse(JSON.stringify(base)))
    expect(parsed).toEqual(base)
  })

  it("金貨と召喚石は0以上の整数だけ", () => {
    for (const gold of [0, 1, 999999]) expect(accepts({ gold })).toBe(true)
    for (const gold of [-1, 0.5, Number.NaN, "10", null])
      expect(accepts({ gold }), `${gold}`).toBe(false)
    expect(accepts({ stones: 0 })).toBe(true)
    expect(accepts({ stones: -1 })).toBe(false)
  })

  it("保存の出撃は1〜4人（4人は古い保存。読み込み時に3人へ移す）、仲間は1人以上", () => {
    expect(accepts({ party: base.party })).toBe(true)
    // 始めたては主人公ひとり。募集で3人まで増える
    expect(accepts({ party: base.party.slice(0, 1) })).toBe(true)
    expect(accepts({ party: [] })).toBe(false)
    expect(accepts({ party: [...base.party, "jig"] })).toBe(true)
    expect(accepts({ party: [...base.party, "jig", "luca"] })).toBe(false)
    expect(accepts({ party: ["", "a", "b", "c"] })).toBe(false)
    expect(accepts({ members: base.members.slice(0, 1) })).toBe(true)
    expect(accepts({ members: [] })).toBe(false)
    expect(accepts({ members: [...base.members, base.members[0]] })).toBe(true)
  })

  it("主人公の名前は1〜8文字、外見の id は空でない", () => {
    expect(accepts({ hero: { name: "ノア", look: "purple" } })).toBe(true)
    expect(accepts({ hero: { name: "", look: "purple" } })).toBe(false)
    expect(accepts({ hero: { name: "あ".repeat(8), look: "purple" } })).toBe(
      true
    )
    expect(accepts({ hero: { name: "あ".repeat(9), look: "purple" } })).toBe(
      false
    )
    expect(accepts({ hero: { name: "ノア", look: "" } })).toBe(false)
  })

  it("仲間のHPは0以上、レベルは1以上、最大HPは1以上", () => {
    expect(member({ hp: 0 })).toBe(true)
    expect(member({ hp: -1 })).toBe(false)
    expect(member({ lv: 1 })).toBe(true)
    expect(member({ lv: 0 })).toBe(false)
    expect(member({ stats: { maxHp: 1, str: 0, tec: 0, spd: 0 } })).toBe(true)
    expect(member({ stats: { maxHp: 0, str: 0, tec: 0, spd: 0 } })).toBe(false)
    expect(member({ stats: { maxHp: 10, str: -1, tec: 0, spd: 0 } })).toBe(
      false
    )
    expect(member({ exp: 0 })).toBe(true)
    expect(member({ exp: -1 })).toBe(false)
  })

  it("疲れと汚れは0〜100", () => {
    for (const value of [0, 50, 100]) {
      expect(member({ fatigue: value })).toBe(true)
      expect(member({ dirt: value })).toBe(true)
    }
    for (const value of [-1, 101]) {
      expect(member({ fatigue: value })).toBe(false)
      expect(member({ dirt: value })).toBe(false)
    }
  })

  it("使ったワザの回数は1以上（0の記録は残さない）", () => {
    expect(member({ used: [] })).toBe(true)
    expect(member({ used: [{ skill: "slash", count: 1 }] })).toBe(true)
    expect(member({ used: [{ skill: "slash", count: 0 }] })).toBe(false)
    expect(member({ used: [{ skill: "", count: 1 }] })).toBe(false)
  })

  it("状態異常の残りは1以上で、知らない種類は入れられない", () => {
    expect(member({ status: [{ kind: "poison", turns: 1 }] })).toBe(true)
    expect(member({ status: [{ kind: "poison", turns: 0 }] })).toBe(false)
    expect(member({ status: [{ kind: "sleep", turns: 1 }] })).toBe(false)
  })

  it("袋の数は1以上（0の品物は消す）", () => {
    expect(accepts({ bag: [] })).toBe(true)
    expect(accepts({ bag: [{ good: contentId("potion"), count: 1 }] })).toBe(
      true
    )
    expect(accepts({ bag: [{ good: contentId("potion"), count: 0 }] })).toBe(
      false
    )
    expect(accepts({ bag: [{ good: contentId("potion"), count: -1 }] })).toBe(
      false
    )
  })

  it("装備の段・手応え・耐久の減りは0以上", () => {
    for (const key of ["plus", "progress", "wear"]) {
      expect(gear({ [key]: 0 }), key).toBe(true)
      expect(gear({ [key]: -1 }), key).toBe(false)
      expect(gear({ [key]: 0.5 }), key).toBe(false)
    }
  })

  it("武器の個体のワザはちょうど3つで、レア度は決まった3つだけ", () => {
    const weapon = base.gear.find((entry) => entry.weapon)!.weapon!
    expect(gear({ weapon })).toBe(true)
    expect(
      gear({ weapon: { ...weapon, skills: weapon.skills.slice(0, 2) } })
    ).toBe(false)
    expect(
      gear({
        weapon: { ...weapon, skills: [...weapon.skills, weapon.skills[0]] },
      })
    ).toBe(false)
    for (const rarity of ["N", "R", "SR"])
      expect(gear({ weapon: { ...weapon, rarity } }), rarity).toBe(true)
    expect(gear({ weapon: { ...weapon, rarity: "UR" } })).toBe(false)
    expect(gear({ weapon: { ...weapon, extraPower: -1 } })).toBe(false)
    expect(gear({ weapon: null })).toBe(true)
  })

  it("知らない項目が混ざった保存は通さない", () => {
    expect(accepts({ extra: 1 })).toBe(false)
    expect(member({ mp: 10 })).toBe(false)
    expect(gear({ slot: "armor" })).toBe(false)
    expect(
      stateSchema.safeParse({
        ...base,
        wipe: { layer: contentId("layer0"), gold: 0, goods: [], extra: 1 },
      }).success
    ).toBe(false)
  })

  it("悪魔は0体でもよく、レベルは1以上", () => {
    // 始めたては契約なし（合体しないで戦う）
    expect(accepts({ demons: [], contract: null })).toBe(true)
    expect(accepts({ demons: [{ id: "nui", lv: 1, exp: 0 }] })).toBe(true)
    expect(accepts({ demons: [{ id: "nui", lv: 0, exp: 0 }] })).toBe(false)
  })

  it("戦闘は敵1体以上・行動順2つ以上・敵のHPは0以上", () => {
    const battle = aState()
      .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
      .build()
    expect(stateSchema.safeParse(battle).success).toBe(true)
    const phaseWith = (patch: Record<string, unknown>) =>
      stateSchema.safeParse({
        ...battle,
        phase: {
          ...battle.phase,
          battle: { ...(battle.phase as { battle: object }).battle, ...patch },
        },
      }).success
    expect(phaseWith({ foes: [] })).toBe(false)
    expect(phaseWith({ order: [{ kind: "member", id: "alda" }] })).toBe(false)
    expect(phaseWith({ turn: -1 })).toBe(false)
    expect(
      phaseWith({
        foes: [
          {
            id: "foe-1",
            foe: contentId("kamokutsu"),
            hp: 0,
            maxHp: 1,
            status: [],
          },
        ],
      })
    ).toBe(true)
    expect(
      phaseWith({
        foes: [
          {
            id: "foe-1",
            foe: contentId("kamokutsu"),
            hp: -1,
            maxHp: 1,
            status: [],
          },
        ],
      })
    ).toBe(false)
    expect(
      phaseWith({
        foes: [
          {
            id: "foe-1",
            foe: contentId("kamokutsu"),
            hp: 0,
            maxHp: 0,
            status: [],
          },
        ],
      })
    ).toBe(false)
    expect(phaseWith({ order: [{ kind: "ghost", id: "x" }] })).toBe(false)
  })

  it("フェーズは街・探索・戦闘の三つだけ", () => {
    expect(accepts({ phase: { type: "town" } })).toBe(true)
    expect(accepts({ phase: { type: "town", extra: 1 } })).toBe(false)
    expect(accepts({ phase: { type: "shop" } })).toBe(false)
    expect(accepts({ phase: { type: "expedition" } })).toBe(false)
  })

  it("板（pending）は宝・罠・戦利品の三つだけ", () => {
    const pending = (value: unknown) =>
      stateSchema.safeParse({
        ...base,
        phase: {
          type: "expedition",
          expedition: {
            layer: contentId("layer0"),
            at: "s",
            visited: ["s"],
            events: [],
            pending: value,
            loot: { gold: 0, goods: [] },
            cleared: false,
          },
        },
      }).success
    expect(pending(null)).toBe(true)
    expect(pending({ kind: "treasure", gold: 0, goods: [] })).toBe(true)
    expect(pending({ kind: "trap", damage: 0 })).toBe(true)
    expect(
      pending({ kind: "loot", gold: 0, goods: [], boss: false, stones: 0 })
    ).toBe(true)
    expect(pending({ kind: "loot", gold: 0, goods: [], boss: false })).toBe(
      false
    )
    expect(pending({ kind: "loot", gold: 0, goods: [] })).toBe(false)
    expect(pending({ kind: "trap", damage: -1 })).toBe(false)
    expect(pending({ kind: "ghost" })).toBe(false)
  })
})
