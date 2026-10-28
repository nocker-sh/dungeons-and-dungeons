import {
  TuningEvaluator,
  type Evaluation,
} from "@/builder/lib/tuning/evaluation"
import {
  type Knob,
  type TuneOptions,
  type TuneResult,
  type TuneStop,
  type TuneChange,
} from "@/builder/lib/tuning/types"
import { EPSILON } from "@/builder/lib/tuning/tolerance-of"
import { withinTarget } from "@/builder/lib/tuning/within-target"
import { knobLabel } from "@/builder/lib/tuning/knob-label"
import { knobInteger } from "@/builder/lib/tuning/knob-integer"
import { knobStep } from "@/builder/lib/tuning/knob-step"
import { knobExpressions } from "@/builder/lib/tuning/knob-expressions"
import { snapKnob } from "@/builder/lib/tuning/snap-knob"
import { formatKnobValue } from "@/builder/lib/tuning/format-knob-value"

/** 動かした幅への罰（範囲の全幅を動かして 0.02）。 */
const DISTANCE_COST = 0.02

/** つまみを1つ動かすことへの罰。 */
const KNOB_COST = 0.01

/** 直線探索で伸ばす倍率の上限。 */
const GROWTH_LIMIT = 64

type KnobState = {
  knob: Knob
  base: number
  integer: boolean
  step: number
  span: number
  keep: number
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

  const evaluator = new TuningEvaluator({
    targets,
    budget,
    measure: options.measure,
  })

  const overridesFor = (values: readonly number[]) =>
    states.flatMap((state, index) =>
      knobExpressions(state.knob, state.base, values[index])
    )

  const changeCost = (values: readonly number[]) => {
    let cost = 0
    for (const [index, state] of states.entries()) {
      const distance = Math.abs(values[index] - state.base)
      if (!distance) continue
      cost += state.keep * (KNOB_COST + DISTANCE_COST * (distance / state.span))
    }
    return cost
  }

  const evaluate = (values: readonly number[], seedList: readonly number[]) =>
    evaluator.evaluate([...baseOverrides, ...overridesFor(values)], seedList)

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
      measurements: evaluator.measurements,
      cacheHits: evaluator.cacheHits,
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
    if (evaluator.measurements >= budget) {
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
            evaluator.outOfBudget = true
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
        if (evaluator.outOfBudget) break
      }
    if (!best || best.gain <= EPSILON) {
      stop = evaluator.outOfBudget ? "budget" : "no-progress"
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
