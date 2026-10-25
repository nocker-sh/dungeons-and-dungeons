import { DEFAULT_PLAN, PUSH_PLAN } from "./lib/policy"
import { withinTarget } from "./lib/tune"
import {
  meanInterval,
  rateInterval,
  settled,
  type Range,
} from "./lib/sequential"
import {
  battleTrials,
  campaignTrials,
  dungeonTrials,
  levelFor,
} from "./lib/simulate"

/**
 * バランスの目標。report / check が測って合否を出す。
 * 目標そのものを変えるときはユーザーの意図（.docs/game-spec.md）と合わせる。
 */
export type Target = {
  id: string
  /** 何を測るか。 */
  label: string
  min?: number
  max?: number
  /** 表示の単位。rate は % で出す。 */
  unit: "rate" | "count"
  measure: (options: MeasureOptions) => number
}

type MeasureOptions = {
  overrides: readonly string[]
  /** 回す回数の上限。range があれば、合否が決まったところで打ち切る。 */
  runs: number
  seed: number
  /** この目標の範囲。渡すと逐次検定で打ち切る（check / report）。 */
  range?: Range
}

/** 勝率が目標の内側か外側に決まったら打ち切る。 */
const untilRate = (range: Range | undefined) =>
  range &&
  (({ wins, runs }: { wins: number; runs: number }) =>
    settled(rateInterval(wins, runs), range))

const small = (runs: number) => Math.max(20, Math.round(runs / 5))

const pairs = new Map<string, ReturnType<typeof battleTrials>>()
function molePair(
  { overrides, runs, seed, range }: MeasureOptions,
  /** 打ち切りの基準にする値（勝率か、残るHPの平均）。 */
  judged: "win" | "hp"
) {
  const key = JSON.stringify([overrides, runs, seed, range, judged])
  let result = pairs.get(key)
  if (!result) {
    result = battleTrials({
      overrides,
      foes: ["kamokutsu", "kamokutsu"],
      boss: false,
      runs,
      seed,
      style: "smart",
      setup: {},
      until:
        range &&
        (judged === "win"
          ? untilRate(range)
          : ({ hpLeft }) => settled(meanInterval(hpLeft), range)),
    })
    pairs.set(key, result)
  }
  return result
}

/**
 * 層をまたぐ一周の測定の回数。踏破まで回すと1回で数秒かかるので、
 * 戦闘の目標（--runs）とは別に少ない回数にする。
 * 一周の測定は種に対して敏感なので、ぶれを抑えるために8回を下限にする。
 */
const campaignRuns = (runs: number) => Math.max(8, Math.round(runs / 20))

/** 層の数と、一周で許す出撃の回数。踏破までをこの中に収める。 */
const LAYERS = 5
const EXPEDITIONS = 60

/**
 * 層ごとの「前の層を突破したころ」の目安のレベル。
 * その層の中ボス・ボスに挑める頃かどうかを測るために使う（実測から決めた仮の値）。
 * 1レベルの伸びを重くしたぶん（`balance.expPower`）、以前の 8/13/18/23 から下げた。
 */
const ENTRY_LEVEL = [0, 5, 8, 10, 12] as const

/** 一周の測定は重いので、同じ条件なら使い回す。層をまたぐ目標はすべてこれを見る。 */
const campaigns = new Map<string, ReturnType<typeof campaignTrials>>()
type CampaignKey = { overrides: readonly string[]; runs: number; seed: number }
// 一周は目標ごとの範囲で打ち切らないので、範囲は鍵に含めない（層をまたぐ目標で使い回す）
const campaignKey = (options: CampaignKey) =>
  JSON.stringify([options.overrides, options.runs, options.seed])
const campaignOptions = (options: CampaignKey) => ({
  overrides: options.overrides,
  runs: campaignRuns(options.runs),
  seed: options.seed,
  style: "smart" as const,
  plan: DEFAULT_PLAN,
  expeditions: EXPEDITIONS,
  layers: LAYERS,
  potions: 4,
  shop: true,
})
function campaign(options: CampaignKey) {
  const key = campaignKey(options)
  let result = campaigns.get(key)
  if (!result) {
    result = campaignTrials(campaignOptions(options))
    campaigns.set(key, result)
  }
  return result
}

/** 層を突破するまでにかかった出撃の回数（中央値）。突破できなければ出撃の上限。 */
function tripOf(result: ReturnType<typeof campaignTrials>, layer: number) {
  const value = result.layers[layer]?.medianTrip
  return Number.isFinite(value) ? value : EXPEDITIONS
}

/** 層ごとの敵（中ボスとボス）の slug。 */
const LAYER_FOES = [
  { midboss: "haribote", boss: "haribote-adult" },
  { midboss: "washinoko", boss: "washinoko-adult" },
  { midboss: "mitsuashi", boss: "kabemimi-fortress" },
  { midboss: "futabane", boss: "yukimebae" },
  { midboss: "agohitsu", boss: "slime-swordsman" },
] as const

/** 1〜4層の目標：前の層を抜けたばかりでは勝てず、育てて通れるようにする。 */
const deepTargets: Target[] = [1, 2, 3, 4].flatMap((no) => [
  {
    id: `midboss-layer${no}`,
    label: `${no}層に着いたころ（Lv${ENTRY_LEVEL[no]}・${no}層の武器）の3人が8地点目の中ボスに勝つ率`,
    min: 0.4,
    max: 0.85,
    unit: "rate" as const,
    measure: ({ overrides, runs, seed, range }) =>
      battleTrials({
        until: untilRate(range),
        overrides,
        foes: [LAYER_FOES[no].midboss],
        boss: false,
        runs,
        seed,
        style: "smart",
        setup: { level: ENTRY_LEVEL[no], weapons: true, reached: no },
      }).win.p,
  },
  {
    id: `fresh-boss-layer${no}`,
    label: `前の層を抜けたばかり（Lv${ENTRY_LEVEL[no]}・${no - 1}層の武器）の3人が${no}層のボスに勝つ率`,
    max: 0.2,
    unit: "rate" as const,
    measure: ({ overrides, runs, seed, range }) =>
      battleTrials({
        until: untilRate(range),
        overrides,
        foes: [LAYER_FOES[no].boss],
        boss: true,
        runs,
        seed,
        style: "smart",
        setup: { level: ENTRY_LEVEL[no], weapons: true, reached: no - 1 },
      }).win.p,
  },
  {
    id: `campaign-clear-layer${no}`,
    label: `街と探索をくり返して${EXPEDITIONS}回以内に${no}層を突破する率`,
    min: 0.8,
    unit: "rate" as const,
    measure: (options) => campaign(options).layers[no].clear.p,
  },
  {
    id: `campaign-gap-layer${no}`,
    label: `${no - 1}層の突破から${no}層の突破までにかかる出撃回数（中央値）`,
    min: 2,
    max: 14,
    unit: "count" as const,
    measure: (options) => {
      const result = campaign(options)
      return tripOf(result, no) - tripOf(result, no - 1)
    },
  },
])

export const TARGETS: readonly Target[] = [
  {
    id: "first-battle",
    label: "初期パーティが0層のふつうの戦闘（ダックリング2体）に勝つ率",
    min: 0.95,
    unit: "rate",
    measure: ({ overrides, runs, seed, range }) =>
      battleTrials({
        until: untilRate(range),
        overrides,
        foes: ["hiyokobu", "hiyokobu"],
        boss: false,
        runs,
        seed,
        style: "smart",
        setup: {},
      }).win.p,
  },
  {
    id: "mole-pair",
    label:
      "初期パーティがスタンプダック2体（ふつうの戦闘で一番強い組）に勝つ率",
    min: 0.85,
    unit: "rate",
    measure: (options) => molePair(options, "win").win.p,
  },
  {
    id: "mole-pair-hp",
    label: "スタンプダック2体に勝った後に残るHPの割合（消耗させる）",
    min: 0.35,
    max: 0.65,
    unit: "rate",
    measure: (options) => molePair(options, "hp").hpLeft,
  },
  {
    id: "midboss-fresh",
    label: "初期パーティが満タンで8地点目の中ボスに勝つ率",
    min: 0.5,
    max: 0.85,
    unit: "rate",
    measure: ({ overrides, runs, seed, range }) =>
      battleTrials({
        until: untilRate(range),
        overrides,
        foes: ["haribote"],
        boss: false,
        runs,
        seed,
        style: "smart",
        setup: {},
      }).win.p,
  },
  {
    id: "fresh-boss",
    label: "初期パーティが満タンで0層ボスに勝つ率",
    max: 0.15,
    unit: "rate",
    measure: ({ overrides, runs, seed, range }) =>
      battleTrials({
        until: untilRate(range),
        overrides,
        foes: ["haribote-adult"],
        boss: true,
        runs,
        seed,
        style: "smart",
        setup: {},
      }).win.p,
  },
  {
    id: "boss-level",
    label: "店の武器に持ち替えた3人が、満タンで0層ボスに勝率50%へ届くレベル",
    min: 4,
    max: 6,
    unit: "count",
    measure: ({ overrides, runs, seed, range }) =>
      levelFor({
        sequential: !!range,
        overrides,
        foes: ["haribote-adult"],
        boss: true,
        runs: small(runs),
        seed,
        style: "smart",
        threshold: 0.5,
        from: 2,
        to: 12,
        weapons: true,
      }).level ?? Number.POSITIVE_INFINITY,
  },
  {
    id: "fresh-clear",
    label: "初期パーティが0層を撤退せずに突破する率",
    max: 0.05,
    unit: "rate",
    measure: ({ overrides, runs, seed, range }) =>
      dungeonTrials({
        until:
          range &&
          (({ clears, runs }) => settled(rateInterval(clears, runs), range)),
        overrides,
        layer: "layer0",
        runs,
        seed,
        style: "smart",
        plan: PUSH_PLAN,
        setup: {},
      }).clear.p,
  },
  {
    id: "campaign-clear",
    label: `街と探索をくり返して${EXPEDITIONS}回以内に0層を突破する率`,
    min: 0.9,
    unit: "rate",
    measure: (options) => campaign(options).layers[0].clear.p,
  },
  {
    id: "campaign-trips",
    label: "0層を突破するまでの出撃回数（中央値）",
    min: 4,
    max: 12,
    unit: "count",
    measure: (options) => campaign(options).layers[0].medianTrip,
  },
  ...deepTargets,
  {
    id: "campaign-ending",
    label: "踏破（4層のボス撃破）までの出撃回数（中央値）",
    min: 28,
    max: 45,
    unit: "count",
    measure: (options) => tripOf(campaign(options), LAYERS - 1),
  },
  {
    /**
     * 踏破したころのレベル。1レベルの伸びを重くして、踏破が Lv25〜35 に収まるようにした
     * （以前は 50〜60 まで伸びていた）。
     */
    id: "campaign-ending-level",
    label: "踏破したときの出撃メンバーの平均レベル",
    min: 22,
    max: 40,
    unit: "count",
    measure: (options) => campaign(options).layers[LAYERS - 1].level,
  },
]

/** 目標の範囲に入っているか（判定は lib/tune.ts と同じ）。 */
export function judge(target: Target, value: number) {
  return withinTarget(target, value)
}
