import { contentSource, gameContent } from "@/lib/content/game-content"
import { GameCatalog } from "@/lib/wiz/content"
import { createMember } from "@/lib/wiz/members"
import { PartyRules } from "@/lib/wiz/rules"
import type { Member } from "@/lib/wiz/state"

/** 成長を見られる仲間（ゲームの数値を持つ者）。 */
export type GrowthMember = {
  id: string
  startLevel: number
  grows: boolean
  /** 仲間ごとの伸びがなく、共通の伸びを使っているか。 */
  sharedGrowth: boolean
}

type StatKey = keyof Member["stats"]

export const statLabels: { key: StatKey; label: string }[] = [
  { key: "maxHp", label: "最大HP" },
  { key: "str", label: "筋力" },
  { key: "tec", label: "技量" },
  { key: "spd", label: "速さ" },
]

export type StatRange = { average: number; min: number; max: number }

export type GrowthRow = {
  level: number
  /** このレベルから次のレベルまでに必要な経験値。 */
  expToNext: number
  /** 加入時のレベルからこのレベルに届くまでの経験値の合計。 */
  totalExp: number
  stats: Record<StatKey, StatRange>
}

const catalog = new GameCatalog(gameContent)
const rules = new PartyRules(catalog)

const growthMembers: GrowthMember[] = [
  ...contentSource.party,
  ...contentSource.recruits.map((recruit) => recruit.member),
].map((entry) => ({
  id: entry.id,
  startLevel: entry.lv,
  grows: !("hero" in entry && entry.hero),
  sharedGrowth: !("growth" in entry && entry.growth),
}))

/** 設定資料のIDから、成長を見られる仲間を引く。ゲームの数値がなければ undefined。 */
export function growthMemberOf(id: string | undefined) {
  return growthMembers.find((member) => member.id === id)
}

/** 主人公（プレイヤー）の成長。 */
export const heroGrowthMember = growthMemberOf(
  contentSource.party.find((entry) => "hero" in entry && entry.hero)?.id
)

/** 再現できる乱数（mulberry32）。同じ種なら毎回同じ結果になる。 */
function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * エンジンの成長規則（PartyRules.grow）で、加入時から maxLevel まで上げる。
 * 伸びに乱数があるので runs 回試し、レベルごとの平均と幅を返す。装備の補正は含まない。
 */
export function simulateGrowth(
  memberId: string,
  maxLevel = 20,
  runs = 200
): GrowthRow[] {
  const def = catalog.member(memberId)
  if (!def) return []
  if (def.hero)
    return [
      {
        level: def.lv,
        expToNext: 0,
        totalExp: 0,
        stats: Object.fromEntries(
          statLabels.map(({ key }) => [
            key,
            {
              average: def.stats[key],
              min: def.stats[key],
              max: def.stats[key],
            },
          ])
        ) as Record<StatKey, StatRange>,
      },
    ]
  const samples = new Map<number, Member["stats"][]>()
  for (let run = 0; run < runs; run++) {
    const random = seededRandom(run + 1)
    let member = createMember(def)
    samples.set(member.lv, [...(samples.get(member.lv) ?? []), member.stats])
    while (member.lv < maxLevel) {
      member = rules.growth.grow(
        { ...member, exp: rules.growth.expToNext(member.lv) },
        random
      )
      samples.set(member.lv, [...(samples.get(member.lv) ?? []), member.stats])
    }
  }
  const rows: GrowthRow[] = []
  let totalExp = 0
  for (let level = def.lv; level <= maxLevel; level++) {
    const levelSamples = samples.get(level) ?? []
    const stats = Object.fromEntries(
      statLabels.map(({ key }) => {
        const values = levelSamples.map((sample) => sample[key])
        return [
          key,
          {
            average:
              values.reduce((sum, value) => sum + value, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
          },
        ]
      })
    ) as Record<StatKey, StatRange>
    rows.push({
      level,
      expToNext: rules.growth.expToNext(level),
      totalExp,
      stats,
    })
    totalExp += rules.growth.expToNext(level)
  }
  return rows
}
