import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import { assertArrayValue } from "@/lib/wiz/core/assert-array-value"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import { assertRecordValue } from "@/lib/wiz/core/assert-record-value"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

export type WizRankProgressionState = Readonly<{
  experience: number
  thresholds: readonly number[]
}>

const rankProgressionConstructionToken = Symbol(
  "WizRankProgression.constructor"
)
const authenticRankProgressions = new WeakSet<object>()
const rankProgressionOwnership = new WizObjectService()

const parseState = (
  state: WizRankProgressionState
): WizRankProgressionState => {
  assertRecordValue("rank-progression", "$", state)
  assertFiniteNumberValue("rank-progression", "experience", state.experience, {
    minimum: 0,
    safeInteger: true,
  })
  assertArrayValue("rank-progression", "thresholds", state.thresholds)
  if (state.thresholds.length === 0) {
    throw new WizValueValidationError(
      "rank-progression",
      "thresholds",
      state.thresholds,
      "a non-empty array whose first threshold is 0"
    )
  }

  let previous = -1
  for (const [index, threshold] of state.thresholds.entries()) {
    assertFiniteNumberValue(
      "rank-progression",
      `thresholds[${index}]`,
      threshold,
      {
        minimum: 0,
        safeInteger: true,
      }
    )
    if (index === 0 && threshold !== 0) {
      throw new WizValueValidationError(
        "rank-progression",
        "thresholds[0]",
        threshold,
        "0 so rank 1 is always available"
      )
    }
    if (threshold <= previous) {
      throw new WizValueValidationError(
        "rank-progression",
        `thresholds[${index}]`,
        threshold,
        `a value greater than ${previous}`
      )
    }
    previous = threshold
  }

  return state
}

/**
 * 累積経験値を、1から始まるrankと次のしきい値へ写す不変value。
 *
 * `thresholds[0]`はrank 1の開始値0で、以降は各rankの累積必要値を表す。
 * 経験値の発生源、解放内容、報酬、永続化は利用側に残す。
 */
export class WizRankProgression {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly #state: WizRankProgressionState

  private constructor(
    token: typeof rankProgressionConstructionToken,
    state: WizRankProgressionState
  ) {
    if (token !== rankProgressionConstructionToken) {
      throw new TypeError(
        "WizRankProgression must be created with create() or fromUnknown()"
      )
    }
    this.#state = rankProgressionOwnership.ownImmutable(
      parseState(state)
    ) as WizRankProgressionState
    authenticRankProgressions.add(this)
    WizImmutableValue.freeze(this)
  }

  static create(state: WizRankProgressionState): WizRankProgression {
    return new WizRankProgression(rankProgressionConstructionToken, state)
  }

  static fromUnknown(input: unknown): WizRankProgression {
    assertRecordValue("rank-progression", "$", input)
    return new WizRankProgression(
      rankProgressionConstructionToken,
      input as WizRankProgressionState
    )
  }

  static require(
    value: unknown,
    label = "Rank progression"
  ): asserts value is WizRankProgression {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticRankProgressions.has(value)
    ) {
      throw new TypeError(
        `${label} must be created with WizRankProgression.create() or fromUnknown()`
      )
    }
  }

  get experience(): number {
    return this.#state.experience
  }

  get thresholds(): readonly number[] {
    return this.#state.thresholds
  }

  get rank(): number {
    let rank = 1
    for (let index = 1; index < this.thresholds.length; index += 1) {
      const threshold = this.thresholds[index]
      if (threshold === undefined || this.experience < threshold) break
      rank = index + 1
    }
    return rank
  }

  get nextRankAt(): number | null {
    return this.thresholds[this.rank] ?? null
  }

  get isMaxRank(): boolean {
    return this.nextRankAt === null
  }

  gain(amount: number): WizRankProgression {
    assertFiniteNumberValue("rank-progression", "amount", amount, {
      minimum: 0,
      safeInteger: true,
    })
    if (amount === 0) return this

    const experience = this.experience + amount
    assertFiniteNumberValue("rank-progression", "experience", experience, {
      minimum: 0,
      safeInteger: true,
    })
    return new WizRankProgression(rankProgressionConstructionToken, {
      ...this.#state,
      experience,
    })
  }

  toPlain(): WizDeepReadonly<WizRankProgressionState> {
    return this.#state as WizDeepReadonly<WizRankProgressionState>
  }
}

Object.freeze(WizRankProgression.prototype)
Object.freeze(WizRankProgression)
