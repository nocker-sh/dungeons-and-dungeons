import type { ExpeditionResult } from "@/builder/lib/simulation/expedition"

/** 出撃ひとつの記録。 */
export type Trip = {
  no: number
  layer: string
  /** 層の名前。 */
  layerName: string
  /** 街で鑑定した武器のレア度。 */
  appraised: (string | null)[]
  /** 出撃の3人の攻撃力の合計（街の準備の前と後）。 */
  attackBefore: number
  attackAfter: number
  /** 出撃前の全員の平均レベル（主人公を含む保存上の値）。 */
  levelBefore: number
  /** 出撃前の育成対象の仲間の平均レベル。 */
  companionLevelBefore: number
  result: ExpeditionResult
  /** 最初の突破なら、その層の名前。 */
  firstClear: string | null
}

export type Playthrough = { trips: Trip[]; endingAt: number | null }

/** 面白さの目安。[少ない, 多い]（片側だけのものは null）。 */
export const FUN_GOALS = {
  actionsPerFight: {
    label: "道中1戦で自分が選ぶ手の数（少ないほどテンポがよい）",
    range: [null, 12],
  },
  bossRounds: { label: "ボス戦のラウンド", range: [6, 12] },
  strongerTrips: {
    label: "出撃の前に攻撃力が上がった割合（強くなった実感）",
    range: [0.4, null],
  },
  hitsPerTrip: {
    label:
      "1出撃あたりの当たり（鑑定の R・SR と敵が落とした武器。多すぎると当たりの価値が薄れる）",
    range: [0.5, 2],
  },
  pinchFights: {
    label: "ピンチを切り抜けた（HPの合計が半分を切ってから勝った）戦闘の割合",
    range: [0.1, 0.35],
  },
  easyFights: {
    label: "楽勝（HPがほとんど減らない）の戦闘の割合",
    range: [null, 0.5],
  },
  wipeTrips: { label: "全滅した出撃の割合", range: [0.05, 0.3] },
  levelGainPerTrip: {
    label: "1出撃あたりのレベルの伸び（育成対象の仲間の平均）",
    range: [0.4, null],
  },
  choicesPerTrip: {
    label: "1出撃あたり、分かれ目で行き先を選んだ回数",
    range: [2, null],
  },
  earlyWipes: {
    label: "最初の3出撃での全滅の回数（始めたてに何も持ち帰れない回数）",
    range: [null, 1],
  },
  endingTrips: { label: "踏破までの出撃回数", range: [28, 45] },
} as const satisfies Record<
  string,
  { label: string; range: readonly [number | null, number | null] }
>
