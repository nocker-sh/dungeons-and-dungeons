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

/** 届かない・測れないときの逸脱。有限の値ならここまで大きくならない。 */
export const UNREACHABLE_DEVIATION = 8
/** 動かした幅への罰（範囲の全幅を動かして 0.02）。 */
const DISTANCE_COST = 0.02
/** つまみを1つ動かすことへの罰。 */
const KNOB_COST = 0.01
/** 直線探索で伸ばす倍率の上限。 */
const GROWTH_LIMIT = 64
const EPSILON = 1e-9

export function knobPaths(knob: Knob): readonly string[] {
  return typeof knob.path === "string" ? [knob.path] : knob.path
}

export function knobLabel(knob: Knob): string {
  if (knob.label) return knob.label
  const paths = knobPaths(knob)
  const head =
    paths.length > 1 ? `${paths[0]} ほか${paths.length - 1}件` : paths[0]
  return knob.mode === "scale" ? `${head}（倍率）` : head
}

/** 一度に動かす幅。 */
export function knobStep(knob: Knob, integer: boolean): number {
  if (knob.step !== undefined && knob.step > 0) return knob.step
  const span = Math.abs(knob.max - knob.min) / 20
  return integer ? Math.max(1, Math.round(span)) : span || 1
}

function knobInteger(knob: Knob, base: number): boolean {
  if (knob.integer !== undefined) return knob.integer
  return knob.mode === "scale" ? false : Number.isInteger(base)
}

const round6 = (value: number) => Math.round(value * 1e6) / 1e6

/** 値を幅の刻みに乗せ、min/max に収める。刻みは今の値を起点にする。 */
export function snapKnob(
  knob: Knob,
  base: number,
  value: number,
  options?: { step?: number; integer?: boolean }
): number {
  const integer = options?.integer ?? knobInteger(knob, base)
  const step = options?.step ?? knobStep(knob, integer)
  const low = Math.min(knob.min, knob.max)
  const high = Math.max(knob.min, knob.max)
  const snapped = base + Math.round((value - base) / step) * step
  const clamped = Math.min(high, Math.max(low, snapped))
  return integer ? Math.round(clamped) : round6(clamped)
}

/** 目標の「これくらい外れたら 1」の幅。 */
export function toleranceOf(target: TuneTarget): number {
  if (target.min !== undefined && target.max !== undefined)
    return Math.max(Math.abs(target.max - target.min), EPSILON)
  const bound = target.min ?? target.max ?? 1
  if (target.unit === "rate") return 0.1
  return Math.max(1, Math.abs(bound) * 0.2)
}

/** 範囲からの外れ具合。範囲の中なら0。 */
export function deviationOf(target: TuneTarget, value: number): number {
  if (!Number.isFinite(value)) return UNREACHABLE_DEVIATION
  const tolerance = toleranceOf(target)
  // 頭を押さえない。押さえると遠いところで傾きが消えて、動かす向きが分からなくなる。
  if (target.min !== undefined && value < target.min)
    return (target.min - value) / tolerance
  if (target.max !== undefined && value > target.max)
    return (value - target.max) / tolerance
  return 0
}

/** 目標の範囲に入っているか。 */
export function withinTarget(target: TuneTarget, value: number): boolean {
  return deviationOf(target, value) === 0
}

/** 数値を上書きの書き方にする。 */
export function formatKnobValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(round6(value))
}

/** つまみの値を上書きの式にする。今の値と同じなら空。 */
export function knobExpressions(
  knob: Knob,
  base: number,
  value: number
): string[] {
  if (value === base) return []
  const operator = knob.mode === "scale" ? "*=" : "="
  const text = formatKnobValue(value)
  return knobPaths(knob).map((path) => `${path}${operator}${text}`)
}

/** 読み込んだ指定を確かめる（JSON でも同じ形にする）。 */
export function parseTuningSpec(raw: unknown): TuningSpec {
  if (!raw || typeof raw !== "object") throw new Error("調整の指定が読めない")
  const source = raw as Record<string, unknown>
  const id = source.id
  if (typeof id !== "string" || !id) throw new Error("調整の指定に id が要る")
  const targets = source.targets
  if (!Array.isArray(targets) || !targets.length)
    throw new Error(`${id}: 満たす目標（targets）が要る`)
  for (const target of targets)
    if (typeof target !== "string")
      throw new Error(`${id}: targets は目標の id の並び`)
  const knobs = source.knobs
  if (!Array.isArray(knobs) || !knobs.length)
    throw new Error(`${id}: 動かす数値（knobs）が要る`)
  const checked = knobs.map((entry, index) => {
    if (!entry || typeof entry !== "object")
      throw new Error(`${id}: ${index + 1}番目の knob が読めない`)
    const knob = entry as Record<string, unknown>
    const paths =
      typeof knob.path === "string"
        ? [knob.path]
        : Array.isArray(knob.path) &&
            knob.path.every((p) => typeof p === "string")
          ? (knob.path as string[])
          : undefined
    if (!paths?.length)
      throw new Error(`${id}: ${index + 1}番目の knob に path が要る`)
    if (typeof knob.min !== "number" || typeof knob.max !== "number")
      throw new Error(`${id}: ${paths[0]} に min と max が要る`)
    if (knob.min > knob.max)
      throw new Error(`${id}: ${paths[0]} の min が max より大きい`)
    if (knob.mode !== undefined && knob.mode !== "set" && knob.mode !== "scale")
      throw new Error(`${id}: ${paths[0]} の mode は set か scale`)
    const number = (key: string) =>
      typeof knob[key] === "number" ? (knob[key] as number) : undefined
    const checkedKnob: Knob = {
      path: paths,
      mode: knob.mode,
      min: knob.min,
      max: knob.max,
      step: number("step"),
      integer: typeof knob.integer === "boolean" ? knob.integer : undefined,
      keep: number("keep"),
      label: typeof knob.label === "string" ? knob.label : undefined,
    }
    return checkedKnob
  })
  return {
    id,
    label: typeof source.label === "string" ? source.label : undefined,
    targets: targets as string[],
    knobs: checked,
  }
}

type KnobState = {
  knob: Knob
  base: number
  integer: boolean
  step: number
  span: number
  keep: number
}

type Evaluation = {
  /** いちばん悪い種での逸脱の合計。 */
  deviation: number
  /** いちばん悪かった種。次の効き方はこの種で測る。 */
  worstSeed: number
  pass: boolean
  /** 目標ごとの、いちばん外れた種での値。 */
  values: Record<string, number>
  failing: string[]
}

/**
 * 候補の良さ。逸脱で先に比べ、同じなら動かした量が少ない方を選ぶ。
 * 足して一つの点数にすると、逸脱がわずかしか減らないとき動かせなくなる。
 */
type Score = { deviation: number; cost: number }

const compareScore = (a: Score, b: Score) =>
  Math.abs(a.deviation - b.deviation) > EPSILON
    ? a.deviation - b.deviation
    : a.cost - b.cost

const show = (target: TuneTarget, value: number) =>
  !Number.isFinite(value)
    ? "届かない"
    : target.unit === "rate"
      ? `${(value * 100).toFixed(1)}%`
      : value.toFixed(1)

/** 目標の範囲を文字にする。 */
export function rangeText(target: TuneTarget): string {
  const low = target.min !== undefined ? show(target, target.min) : ""
  const high = target.max !== undefined ? show(target, target.max) : ""
  return `${low}〜${high}`
}

/**
 * 目標から外れているつまみを動かして範囲へ入れる。
 *
 * 1. 種ごとに測って、範囲からの逸脱の合計（いちばん悪い種）を点数にする。
 * 2. いちばん悪い種で、つまみを1刻みだけ±へ動かして効き方を測る。刻みで測定値が
 *    変わらなければ大きく動かして確かめ、それでも変わらなければ以後は測らない。
 * 3. いちばん効くつまみをその向きへ倍々に伸ばし、行き過ぎたら間を試す（単調なら一気に届く）。
 * 4. 全ての種で確かめて、良くなったときだけ採用する。だめならその向きは諦める。
 * 5. 逸脱が同じなら、動かす数が少なく幅の小さい方を選ぶ。
 */
export function tune(options: TuneOptions): TuneResult {
  const seeds = options.seeds?.length ? options.seeds : [1, 7, 23]
  const budget = options.budget ?? 60
  const baseOverrides = options.baseOverrides ?? []
  const targets = options.targets
  const progress = options.onProgress ?? (() => {})
  if (!targets.length) throw new Error("満たす目標がない")

  const states: KnobState[] = options.spec.knobs.map((knob) => {
    const base = options.baseValue(knob)
    if (!Number.isFinite(base))
      throw new Error(`${knobLabel(knob)} の今の値が数値でない`)
    const integer = knobInteger(knob, base)
    return {
      knob,
      base,
      integer,
      step: knobStep(knob, integer),
      span: Math.max(Math.abs(knob.max - knob.min), EPSILON),
      keep: knob.keep && knob.keep > 0 ? knob.keep : 1,
    }
  })

  const cache = new Map<string, Record<string, number>>()
  let measurements = 0
  let cacheHits = 0
  let outOfBudget = false

  const overridesFor = (values: readonly number[]) =>
    states.flatMap((state, index) =>
      knobExpressions(state.knob, state.base, values[index])
    )

  const measureOnce = (overrides: readonly string[], seed: number) => {
    const key = JSON.stringify([overrides, seed])
    const cached = cache.get(key)
    if (cached) {
      cacheHits++
      return cached
    }
    if (measurements >= budget) {
      outOfBudget = true
      return undefined
    }
    measurements++
    const measured = options.measure({ overrides, seed })
    cache.set(key, measured)
    return measured
  }

  const changeCost = (values: readonly number[]) => {
    let cost = 0
    for (const [index, state] of states.entries()) {
      const distance = Math.abs(values[index] - state.base)
      if (!distance) continue
      cost += state.keep * (KNOB_COST + DISTANCE_COST * (distance / state.span))
    }
    return cost
  }

  const evaluate = (
    values: readonly number[],
    seedList: readonly number[]
  ): Evaluation | undefined => {
    const overrides = [...baseOverrides, ...overridesFor(values)]
    const worstValue: Record<string, number> = {}
    const worstDeviation: Record<string, number> = {}
    let deviation = 0
    let worstSeed = seedList[0]
    for (const seed of seedList) {
      const measured = measureOnce(overrides, seed)
      if (!measured) return undefined
      let sum = 0
      for (const target of targets) {
        const value = measured[target.id] ?? Number.NaN
        const single = deviationOf(target, value)
        sum += single
        if (
          !(target.id in worstDeviation) ||
          single > worstDeviation[target.id]
        ) {
          worstDeviation[target.id] = single
          worstValue[target.id] = value
        }
      }
      if (sum > deviation) {
        deviation = sum
        worstSeed = seed
      }
    }
    const failing = targets
      .filter((target) => worstDeviation[target.id] > 0)
      .map((target) => target.id)
    return {
      deviation,
      worstSeed,
      pass: !failing.length,
      values: worstValue,
      failing,
    }
  }

  const scoreOf = (
    evaluation: Evaluation,
    values: readonly number[]
  ): Score => ({ deviation: evaluation.deviation, cost: changeCost(values) })

  /** 一つの種だけで測る（効き方の見積もりと直線探索用）。 */
  const probe = (values: readonly number[], seed: number) => {
    const evaluation = evaluate(values, [seed])
    return evaluation
      ? { evaluation, score: scoreOf(evaluation, values) }
      : undefined
  }

  /** 測定値がまったく同じなら、そのつまみはこの目標に効いていない。 */
  const sameValues = (a: Record<string, number>, b: Record<string, number>) =>
    targets.every((target) => Object.is(a[target.id], b[target.id]))

  const moved = (
    values: readonly number[],
    index: number,
    direction: number,
    steps: number
  ) => {
    const state = states[index]
    const next = snapKnob(
      state.knob,
      state.base,
      values[index] + direction * state.step * steps,
      { step: state.step, integer: state.integer }
    )
    if (next === values[index]) return undefined
    const copy = [...values]
    copy[index] = next
    return copy
  }

  const baseValues = states.map((state) => state.base)
  const before = evaluate(baseValues, seeds)
  if (!before) throw new Error("測定の上限が小さすぎて、今の値すら測れない")
  progress(
    `つまみ${states.length}個 / 目標${targets.length}件 / 種 ${seeds.join(",")} / 測定の上限 ${budget}回`
  )
  progress(
    `いまの値：逸脱 ${before.deviation.toFixed(2)}${
      before.pass
        ? "（すべて範囲の中）"
        : `（外れ ${before.failing.join(", ")}）`
    }`
  )

  const finish = (
    stop: TuneStop,
    after: Evaluation,
    values: readonly number[],
    iterations: number
  ): TuneResult => {
    const changes: TuneChange[] = []
    for (const [index, state] of states.entries()) {
      const expressions = knobExpressions(state.knob, state.base, values[index])
      if (!expressions.length) continue
      changes.push({
        label: knobLabel(state.knob),
        from: state.base,
        to: values[index],
        expressions,
      })
    }
    return {
      passed: after.pass,
      stop,
      measurements,
      cacheHits,
      iterations,
      deviationBefore: before.deviation,
      deviationAfter: after.deviation,
      metrics: targets.map((target) => ({
        id: target.id,
        label: target.label,
        min: target.min,
        max: target.max,
        unit: target.unit,
        before: before.values[target.id],
        after: after.values[target.id],
        okBefore: withinTarget(target, before.values[target.id]),
        okAfter: withinTarget(target, after.values[target.id]),
      })),
      changes,
      overrides: changes.flatMap((change) => change.expressions),
    }
  }

  if (before.pass) {
    progress("すでにすべての目標が範囲の中。数値は動かさない。")
    return finish("already", before, baseValues, 0)
  }

  // 範囲の外から始まったら、まず範囲へ入れる。
  let currentValues = states.map((state, index) =>
    snapKnob(state.knob, state.base, baseValues[index], {
      step: state.step,
      integer: state.integer,
    })
  )
  let current = before
  if (currentValues.some((value, index) => value !== baseValues[index])) {
    const clamped = evaluate(currentValues, seeds)
    if (!clamped) return finish("budget", before, baseValues, 0)
    progress(
      `つまみの範囲外だった値を範囲へ入れた（逸脱 ${before.deviation.toFixed(2)} → ${clamped.deviation.toFixed(2)}）`
    )
    current = clamped
  }

  /** 同じ向きへは効かないと分かった組み合わせ。 */
  const blocked = new Set<string>()
  /** 大きく動かしても測定値が変わらなかったつまみ。以後は測らない。 */
  const inert = new Set<number>()
  /** 前に効いたつまみ。次も効くならそのまま使う（探索を省く）。 */
  let lastMove: { index: number; direction: number } | undefined
  let iterations = 0
  let stop: TuneStop = current.pass ? "passed" : "budget"
  while (!current.pass) {
    if (measurements >= budget) {
      stop = "budget"
      break
    }
    iterations++
    progress(
      `[${iterations}] 効き方を測る（外れ ${current.failing.join(", ")} / 逸脱 ${current.deviation.toFixed(2)}）`
    )
    // いちばん悪かった種で測る。ほかの種で測ると、直したい外れが見えない。
    const probeSeed = current.worstSeed
    const here = probe(currentValues, probeSeed)
    if (!here) {
      stop = "budget"
      break
    }

    type Candidate = {
      index: number
      direction: number
      values: number[]
      score: Score
      gain: number
    }
    /**
     * つまみを1刻み動かして効き方を見る。刻みで測定値が動かなければ、
     * 大きく動かして効かないことを確かめる（刻みが小さすぎるのと区別する）。
     */
    const probeKnob = (
      index: number,
      direction: number
    ): Candidate | "blocked" | "flat" | "budget" => {
      const state = states[index]
      let reachable = false
      for (const steps of [1, GROWTH_LIMIT]) {
        const candidate = moved(currentValues, index, direction, steps)
        if (!candidate) continue
        reachable = true
        const probed = probe(candidate, probeSeed)
        if (!probed) return "budget"
        if (sameValues(probed.evaluation.values, here.evaluation.values))
          continue
        const distance =
          Math.abs(candidate[index] - currentValues[index]) / state.span
        const gain =
          (here.score.deviation - probed.evaluation.deviation) /
          Math.max(distance, EPSILON) /
          state.keep
        progress(
          `    ${knobLabel(state.knob)} ${formatKnobValue(currentValues[index])} → ${formatKnobValue(candidate[index])} 逸脱 ${probed.evaluation.deviation.toFixed(3)}（効き ${gain.toFixed(2)}）`
        )
        return {
          index,
          direction,
          values: candidate,
          score: probed.score,
          gain,
        }
      }
      return reachable ? "flat" : "blocked"
    }

    let best: Candidate | undefined
    const keep = (candidate: Candidate) => {
      if (!best || candidate.gain > best.gain) best = candidate
    }
    // 前に効いたつまみがまだ効くなら、それを使う。
    if (lastMove && !inert.has(lastMove.index)) {
      const result = probeKnob(lastMove.index, lastMove.direction)
      if (result === "budget") {
        stop = "budget"
        break
      }
      if (result === "flat") inert.add(lastMove.index)
      else if (result !== "blocked" && result.gain > EPSILON) keep(result)
    }
    if (!best)
      for (const [index] of states.entries()) {
        if (inert.has(index)) continue
        for (const direction of [1, -1]) {
          if (blocked.has(`${index}:${direction}`)) continue
          const result = probeKnob(index, direction)
          if (result === "budget") {
            outOfBudget = true
            break
          }
          if (result === "flat") {
            progress(`    ${knobLabel(states[index].knob)} は効かない`)
            inert.add(index)
            break
          }
          if (result === "blocked") continue
          keep(result)
          // 効く向きが見つかったら、反対の向きは見ない。
          if (result.gain > EPSILON) break
        }
        if (outOfBudget) break
      }
    if (!best || best.gain <= EPSILON) {
      stop = outOfBudget ? "budget" : "no-progress"
      break
    }

    // 効くつまみを同じ向きへ倍々に伸ばす。行き過ぎたら間を一度だけ試す。
    const chosen = best
    let bestValues = chosen.values
    let bestScore = chosen.score
    let steps = Math.max(
      1,
      Math.round(
        Math.abs(bestValues[chosen.index] - currentValues[chosen.index]) /
          states[chosen.index].step
      )
    )
    while (steps * 2 <= GROWTH_LIMIT) {
      const candidate = moved(
        currentValues,
        chosen.index,
        chosen.direction,
        steps * 2
      )
      if (!candidate || candidate[chosen.index] === bestValues[chosen.index])
        break
      const probed = probe(candidate, probeSeed)
      if (!probed) break
      if (compareScore(probed.score, bestScore) < 0) {
        bestScore = probed.score
        bestValues = candidate
        steps *= 2
        continue
      }
      const middle = moved(
        currentValues,
        chosen.index,
        chosen.direction,
        Math.round(steps * 1.5)
      )
      if (middle && middle[chosen.index] !== bestValues[chosen.index]) {
        const probedMiddle = probe(middle, probeSeed)
        if (probedMiddle && compareScore(probedMiddle.score, bestScore) < 0) {
          bestScore = probedMiddle.score
          bestValues = middle
        }
      }
      break
    }

    const confirmed = evaluate(bestValues, seeds)
    if (!confirmed) {
      stop = "budget"
      break
    }
    const label = knobLabel(states[chosen.index].knob)
    if (
      compareScore(
        scoreOf(confirmed, bestValues),
        scoreOf(current, currentValues)
      ) < 0
    ) {
      progress(
        `[${iterations}] ${label} ${formatKnobValue(currentValues[chosen.index])} → ${formatKnobValue(bestValues[chosen.index])} を採用（逸脱 ${current.deviation.toFixed(2)} → ${confirmed.deviation.toFixed(2)}）`
      )
      currentValues = bestValues
      current = confirmed
      lastMove = { index: chosen.index, direction: chosen.direction }
      blocked.clear()
    } else {
      progress(
        `[${iterations}] ${label} は他の種で良くならないので見送る（逸脱 ${confirmed.deviation.toFixed(2)}）`
      )
      blocked.add(`${chosen.index}:${chosen.direction}`)
      if (lastMove?.index === chosen.index) lastMove = undefined
    }
    if (current.pass) stop = "passed"
  }
  if (current.pass) stop = "passed"
  return finish(stop, current, currentValues, iterations)
}
