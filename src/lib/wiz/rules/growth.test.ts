import { describe, expect, it } from "vite-plus/test"
import { memberBySlug, realContent } from "@/lib/wiz/testing"
import { GameCatalog, PartyRules, type GameState } from "@/lib/wiz"

describe("成長の型", () => {
  const source = realContent()
  // 控えめ型は検証専用の定義。作品のハスキーの調整値には依存しない。
  const content = {
    ...source,
    recruits: source.recruits.map((entry) =>
      entry.member.id === memberBySlug("husky").id
        ? {
            ...entry,
            member: { ...entry.member, growthType: "modest" as const },
          }
        : entry
    ),
  }
  const rules = new PartyRules(new GameCatalog(content))
  const { bands, types } = content.balance.growthCurve
  const [middleFrom, lateFrom] = bands
  /** 成長の型ごとの代表。倍率は作品データの growthCurve から読む。 */
  const samples = [
    ["alda", "normal"],
    ["jig", "early"],
    ["luca", "late"],
    ["husky", "modest"],
  ] as const

  /** その段の中で、1レベルあたりに伸びる最大HP。 */
  const perLevel = (slug: string, from: number, to: number) => {
    const id = memberBySlug(slug).id
    let total = 0
    for (let lv = from; lv < to; lv++)
      total += rules.growth.growthGain({ id }, lv).maxHp
    return total / (to - from)
  }

  it("[feature:W007] 段（序盤・中盤・終盤）で伸びの倍率が変わる", () => {
    expect(rules.growth.bandOf(middleFrom - 1)).toBe("early")
    expect(rules.growth.bandOf(middleFrom)).toBe("middle")
    expect(rules.growth.bandOf(lateFrom - 1)).toBe("middle")
    expect(rules.growth.bandOf(lateFrom)).toBe("late")
    for (const [slug, type] of samples) {
      const id = memberBySlug(slug).id
      expect(rules.growth.growthTypeOf({ id }), slug).toBe(type)
      // 段ごとの倍率は作品データの growthCurve そのまま
      expect(rules.growth.growthFactor({ id }, middleFrom - 1), slug).toBe(
        types[type]!.early
      )
      expect(rules.growth.growthFactor({ id }, middleFrom), slug).toBe(
        types[type]!.middle
      )
      expect(rules.growth.growthFactor({ id }, lateFrom), slug).toBe(
        types[type]!.late
      )
    }
  })

  it("[feature:W007] 早熟は序盤に伸び、晩成は終盤に伸びる", () => {
    const joinOf = (slug: string) => memberBySlug(slug).lv
    // 早熟は序盤で普通より伸び、中盤では普通に届かない
    expect(perLevel("jig", joinOf("jig"), middleFrom)).toBeGreaterThan(
      perLevel("alda", joinOf("alda"), middleFrom)
    )
    expect(perLevel("jig", middleFrom, lateFrom)).toBeLessThan(
      perLevel("alda", middleFrom, lateFrom)
    )
    // 晩成は終盤で普通を上回り、序盤では普通に届かない
    expect(perLevel("luca", lateFrom, lateFrom + 10)).toBeGreaterThan(
      perLevel("alda", lateFrom, lateFrom + 10)
    )
    expect(perLevel("luca", joinOf("luca"), middleFrom)).toBeLessThan(
      perLevel("alda", joinOf("alda"), middleFrom)
    )
    // 控えめはどの段でも普通より伸びない
    for (const [from, to] of [
      [joinOf("husky"), middleFrom],
      [middleFrom, lateFrom],
      [lateFrom, lateFrom + 10],
    ])
      expect(perLevel("husky", from, to)).toBeLessThan(
        perLevel("alda", Math.max(from, joinOf("alda")), to)
      )
  })

  it("[feature:W007] 型の倍率は宿でのレベルアップに効く", () => {
    const grown = (slug: string, lv: number) => {
      const def = memberBySlug(slug)
      let member: GameState["members"][number] = {
        id: def.id,
        lv: def.lv,
        exp: 0,
        hp: 1,
        stats: { ...def.stats },
        used: [],
        status: [],
        fatigue: 0,
        dirt: 0,
        like: 0,
      }
      while (member.lv < lv)
        member = rules.growth.grow(
          { ...member, exp: rules.growth.expToNext(member.lv) },
          () => 0.99
        )
      return (member.stats.maxHp - def.stats.maxHp) / (lv - def.lv)
    }
    const to = middleFrom - 1
    // 加入時から序盤の終わりまで、1レベルあたりの伸びを比べる
    expect(grown("jig", to)).toBeGreaterThan(grown("alda", to))
    expect(grown("luca", to)).toBeLessThan(grown("alda", to))
    expect(grown("husky", to)).toBeLessThan(grown("alda", to))
  })
})
