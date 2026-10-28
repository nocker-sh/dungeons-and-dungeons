import type { BattleStyle } from "@/builder/lib/policy/battle"
import type { ExpeditionPlan } from "@/builder/lib/policy/expedition"

export type CampaignRun = {
  /** 層ごとに、はじめて突破した出撃の回数。突破できなければ null。 */
  clearedAt: (number | null)[]
  /** 突破したときの全員の平均レベル（主人公を含む保存上の値）。 */
  levelAt: (number | null)[]
  /** 突破したときの育成対象の仲間の平均レベル（主人公・控えを除く）。 */
  companionLevelAt: (number | null)[]
  expeditions: number
  wipes: number
  /** ボス戦での全滅。 */
  bossWipes: number
  finalLevel: number
  finalCompanionLevel: number
  finalGold: number
  /** 鑑定した回数と、鑑定が1回以上あった出撃の回数。 */
  appraisals: number
  appraiseTrips: number
  /** はじめて R か SR を引いた出撃の回数。引けなければ null。 */
  firstRareAt: number | null
  /** 道中の戦闘の数とラウンドの合計、ボス戦の数とラウンドの合計。 */
  battles: number
  battleRounds: number
  bossBattles: number
  bossRounds: number
  /** 防具の修理に払った額と、探索で稼いだ額。 */
  repairGold: number
  earnedGold: number
}

export type CampaignOptions = {
  overrides: readonly string[]
  runs: number
  seed: number
  style: BattleStyle
  plan: ExpeditionPlan
  expeditions: number
  layers: number
  potions: number
  /** 街で装備を買い替える。 */
  shop?: boolean
}
