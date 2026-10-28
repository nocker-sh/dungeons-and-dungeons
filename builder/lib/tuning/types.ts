/**
 * バランスの自動調整。目標（builder/targets.ts）から外れているとき、
 * つまみ（--set のパス）を少しずつ動かして範囲へ入れる。
 *
 * ここはゲームに触らない。測るのは外から渡す measure だけなので、
 * 作り物の指標でも同じ探索を試せる（builder/tune.test.ts）。
 */

/** つまみの動かし方。set は値を入れ替え、scale は今の値に倍率をかける。 */
export type KnobMode = "set" | "scale"

/** 動かす数値ひとつ。 */
export type Knob = {
  /** 上書きのパス（`--set` と同じ書き方）。複数書くと一緒に動く。 */
  path: string | readonly string[]
  mode?: KnobMode
  min: number
  max: number
  /** 一度に動かす幅。省略すると幅の1/20。 */
  step?: number
  /** 整数に丸める。省略すると set は今の値が整数かどうか、scale は丸めない。 */
  integer?: boolean
  /** 大きいほど動かしたくない（既定1）。 */
  keep?: number
  label?: string
}

/** 調整の指定。TS か JSON のファイルで書く。 */
export type TuningSpec = {
  id: string
  label?: string
  /** 満たす目標の id（builder/targets.ts）。 */
  targets: readonly string[]
  knobs: readonly Knob[]
}

/** 目標のうち、合否の判定に要る分だけ。 */
export type TuneTarget = {
  id: string
  label: string
  min?: number
  max?: number
  unit: "rate" | "count"
}

/** 上書きと種を受けて、目標の id ごとの測定値を返す。 */
export type TuneMeasure = (options: {
  overrides: readonly string[]
  seed: number
}) => Record<string, number>

export type TuneOptions = {
  spec: TuningSpec
  /** spec.targets を引いた目標。 */
  targets: readonly TuneTarget[]
  /** 調整を始める前から当てている上書き。 */
  baseOverrides?: readonly string[]
  /** つまみの今の値（scale は 1）。 */
  baseValue: (knob: Knob) => number
  /** 候補はこの全ての種で合格すること。 */
  seeds?: readonly number[]
  /** 測定の上限（上書き×種ひと組で1回）。既定60。 */
  budget?: number
  measure: TuneMeasure
  onProgress?: (line: string) => void
}

export type TuneMetric = {
  id: string
  label: string
  min?: number
  max?: number
  unit: "rate" | "count"
  /** いちばん外れた種での値。 */
  before: number
  after: number
  okBefore: boolean
  okAfter: boolean
}

export type TuneChange = {
  label: string
  from: number
  to: number
  /** 書き出す上書き（パスが複数なら複数行）。 */
  expressions: string[]
}

/** 探索を止めた理由。 */
export type TuneStop = "already" | "passed" | "budget" | "no-progress"

export type TuneResult = {
  passed: boolean
  stop: TuneStop
  /** 測った回数（使い回した分は数えない）。 */
  measurements: number
  /** 使い回した回数。 */
  cacheHits: number
  iterations: number
  deviationBefore: number
  deviationAfter: number
  metrics: TuneMetric[]
  changes: TuneChange[]
  /** 調整で足す上書き（baseOverrides は含まない）。 */
  overrides: string[]
}
