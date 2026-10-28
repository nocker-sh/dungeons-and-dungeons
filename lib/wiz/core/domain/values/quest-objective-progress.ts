import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import { assertRecordValue } from "@/lib/wiz/core/assert-record-value"
import { assertTrimmedNonEmptyStringValue } from "@/lib/wiz/core/assert-trimmed-non-empty-string-value"

export type WizQuestObjectiveProgressState<
  TKind extends string = string,
  TTargetId extends string = string,
> = Readonly<{
  kind: TKind
  targetId: TTargetId
  current: number
  required: number
}>

export type WizQuestObjectiveProgressEvent<
  TKind extends string = string,
  TTargetId extends string = string,
> = Readonly<{
  kind: TKind
  targetId: TTargetId
  amount: number
}>

const questObjectiveProgressConstructionToken = Symbol(
  "WizQuestObjectiveProgress.constructor"
)
const authenticQuestObjectiveProgresses = new WeakSet<object>()
const questObjectiveProgressOwnership = new WizObjectService()

const assertProgressAmount = (
  path: string,
  amount: unknown,
  minimum: number
): void => {
  assertFiniteNumberValue("quest-objective-progress", path, amount, {
    minimum,
    safeInteger: true,
  })
}

const parseState = <TKind extends string, TTargetId extends string>(
  state: WizQuestObjectiveProgressState<TKind, TTargetId>
): WizQuestObjectiveProgressState<TKind, TTargetId> => {
  assertRecordValue("quest-objective-progress", "$", state)
  assertTrimmedNonEmptyStringValue(
    "quest-objective-progress",
    "kind",
    state.kind
  )
  assertTrimmedNonEmptyStringValue(
    "quest-objective-progress",
    "targetId",
    state.targetId
  )
  assertProgressAmount("required", state.required, 1)
  assertFiniteNumberValue(
    "quest-objective-progress",
    "current",
    state.current,
    {
      maximum: state.required,
      minimum: 0,
      safeInteger: true,
    }
  )
  return state
}

const parseEvent = (
  event: WizQuestObjectiveProgressEvent
): WizQuestObjectiveProgressEvent => {
  assertRecordValue("quest-objective-progress", "event", event)
  assertTrimmedNonEmptyStringValue(
    "quest-objective-progress",
    "event.kind",
    event.kind
  )
  assertTrimmedNonEmptyStringValue(
    "quest-objective-progress",
    "event.targetId",
    event.targetId
  )
  assertProgressAmount("event.amount", event.amount, 1)
  return event
}

/**
 * 目標と実際に起きたeventを照合し、必要数まで進める不変value。
 *
 * 受注条件、報酬、永続化は利用側に残し、このvalueは進捗計算だけを所有する。
 */
export class WizQuestObjectiveProgress<
  TKind extends string = string,
  TTargetId extends string = string,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly #state: WizQuestObjectiveProgressState<TKind, TTargetId>

  private constructor(
    token: typeof questObjectiveProgressConstructionToken,
    state: WizQuestObjectiveProgressState<TKind, TTargetId>
  ) {
    if (token !== questObjectiveProgressConstructionToken) {
      throw new TypeError(
        "WizQuestObjectiveProgress must be created with create() or fromUnknown()"
      )
    }
    this.#state = questObjectiveProgressOwnership.ownImmutable(
      parseState(state)
    ) as WizQuestObjectiveProgressState<TKind, TTargetId>
    authenticQuestObjectiveProgresses.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<const TKind extends string, const TTargetId extends string>(
    state: WizQuestObjectiveProgressState<TKind, TTargetId>
  ): WizQuestObjectiveProgress<TKind, TTargetId> {
    return new WizQuestObjectiveProgress(
      questObjectiveProgressConstructionToken,
      state
    )
  }

  static fromUnknown(input: unknown): WizQuestObjectiveProgress {
    assertRecordValue("quest-objective-progress", "$", input)
    return new WizQuestObjectiveProgress(
      questObjectiveProgressConstructionToken,
      input as WizQuestObjectiveProgressState
    )
  }

  static require(
    value: unknown,
    label = "Quest objective progress"
  ): asserts value is WizQuestObjectiveProgress {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticQuestObjectiveProgresses.has(value)
    ) {
      throw new TypeError(
        `${label} must be created with WizQuestObjectiveProgress.create() or fromUnknown()`
      )
    }
  }

  get kind(): TKind {
    return this.#state.kind
  }

  get targetId(): TTargetId {
    return this.#state.targetId
  }

  get current(): number {
    return this.#state.current
  }

  get required(): number {
    return this.#state.required
  }

  get isComplete(): boolean {
    return this.current === this.required
  }

  record(
    event: WizQuestObjectiveProgressEvent
  ): WizQuestObjectiveProgress<TKind, TTargetId> {
    parseEvent(event)
    if (
      this.isComplete ||
      event.kind !== this.kind ||
      event.targetId !== this.targetId
    )
      return this

    const increment = Math.min(this.required - this.current, event.amount)
    return new WizQuestObjectiveProgress(
      questObjectiveProgressConstructionToken,
      {
        ...this.#state,
        current: this.current + increment,
      }
    )
  }

  toPlain(): WizDeepReadonly<WizQuestObjectiveProgressState<TKind, TTargetId>> {
    return this.#state as WizDeepReadonly<
      WizQuestObjectiveProgressState<TKind, TTargetId>
    >
  }
}

Object.freeze(WizQuestObjectiveProgress.prototype)
Object.freeze(WizQuestObjectiveProgress)
