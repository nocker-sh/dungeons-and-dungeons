import { deviationOf } from "@/builder/lib/tuning/deviation-of"
import type { TuneMeasure, TuneTarget } from "@/builder/lib/tuning/types"

export type Evaluation = {
  /** いちばん悪い種での逸脱の合計。 */
  deviation: number
  /** いちばん悪かった種。次の効き方はこの種で測る。 */
  worstSeed: number
  pass: boolean
  /** 目標ごとの、いちばん外れた種での値。 */
  values: Record<string, number>
  failing: string[]
}

/** 測定の予算・キャッシュと、複数の種のうち最悪の結果を受け持つ。 */
export class TuningEvaluator {
  private readonly cache = new Map<string, Record<string, number>>()
  measurements = 0
  cacheHits = 0
  outOfBudget = false
  constructor(
    private readonly options: {
      targets: readonly TuneTarget[]
      budget: number
      measure: TuneMeasure
    }
  ) {}
  private measureOnce(overrides: readonly string[], seed: number) {
    const key = JSON.stringify([overrides, seed])
    const cached = this.cache.get(key)
    if (cached) {
      this.cacheHits++
      return cached
    }
    if (this.measurements >= this.options.budget) {
      this.outOfBudget = true
      return undefined
    }
    this.measurements++
    const measured = this.options.measure({ overrides, seed })
    this.cache.set(key, measured)
    return measured
  }
  evaluate(
    overrides: readonly string[],
    seedList: readonly number[]
  ): Evaluation | undefined {
    const worstValue: Record<string, number> = {}
    const worstDeviation: Record<string, number> = {}
    let deviation = 0
    let worstSeed = seedList[0]
    for (const seed of seedList) {
      const measured = this.measureOnce(overrides, seed)
      if (!measured) return undefined
      let sum = 0
      for (const target of this.options.targets) {
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
    const failing = this.options.targets
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
}
