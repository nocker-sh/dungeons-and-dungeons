import { gameContent } from "@/content/game-content"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { createMember } from "@/lib/wiz/members/create-member"
import { PartyRules } from "@/lib/wiz/rules/party-rules"
import type { Member } from "@/lib/wiz/state/state-schema"
import { seededRandom } from "@/development/seeded-random"

export type StatKey = keyof Member["stats"]

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

export const catalog = new GameCatalog(gameContent)

export const rules = new PartyRules(catalog)

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
