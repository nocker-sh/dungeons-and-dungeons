import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import { createWizStandardActionValue } from "@/lib/wiz/core/presets/standard-actions/create-wiz-standard-action-value"
import type { WizStandardActionValueFor } from "@/lib/wiz/core/presets/standard-actions/standard-action-value"
import type {
  WizStandardCheckedIndex,
  WizStandardCheckedIndexInput,
  WizStandardEventChoiceIndex,
  WizStandardEventId,
} from "@/lib/wiz/core/presets/standard-actions/content-types"

const standardEventActionsConstructionToken = Symbol(
  "WizStandardEventActions.constructor"
)

export class WizStandardEventActions<
  TArrays extends WorldContentArrays,
  TEventId extends WizStandardEventId<TArrays>,
> {
  readonly eventId: TEventId
  readonly #choiceCount: number
  readonly #origin: symbol

  private constructor(
    token: typeof standardEventActionsConstructionToken,
    origin: symbol,
    eventId: TEventId,
    choiceCount: number
  ) {
    if (token !== standardEventActionsConstructionToken) {
      throw new TypeError(
        "WizStandardEventActions must be created by WizStandardActions"
      )
    }
    this.#origin = origin
    this.eventId = eventId
    this.#choiceCount = choiceCount
    Object.freeze(this)
  }

  /** @internal */
  static create<
    TArrays extends WorldContentArrays,
    TEventId extends WizStandardEventId<TArrays>,
  >(
    token: typeof standardEventActionsConstructionToken,
    origin: symbol,
    eventId: TEventId,
    choiceCount: number
  ): WizStandardEventActions<TArrays, TEventId> {
    return new WizStandardEventActions<TArrays, TEventId>(
      token,
      origin,
      eventId,
      choiceCount
    )
  }

  choose<const TCandidate extends number>(
    choiceIndex: WizStandardCheckedIndexInput<
      TCandidate,
      WizStandardEventChoiceIndex<TArrays, TEventId>
    >
  ): WizStandardActionValueFor<{
    type: "SELECT_EVENT_CHOICE"
    eventId: TEventId
    choiceIndex: WizStandardCheckedIndex<
      TCandidate,
      WizStandardEventChoiceIndex<TArrays, TEventId>
    >
  }>
  choose(choiceIndex: number) {
    if (
      !Number.isInteger(choiceIndex) ||
      choiceIndex < 0 ||
      choiceIndex >= this.#choiceCount
    ) {
      throw new RangeError(
        `Unknown choice ${choiceIndex} for standard event "${this.eventId}"`
      )
    }
    return createWizStandardActionValue(this.#origin, {
      type: "SELECT_EVENT_CHOICE",
      eventId: this.eventId,
      choiceIndex,
    })
  }

  roll() {
    return createWizStandardActionValue(this.#origin, {
      type: "ROLL_DICE",
      eventId: this.eventId,
    })
  }
}

Object.freeze(WizStandardEventActions.prototype)
Object.freeze(WizStandardEventActions)

/** @internal */
export const createWizStandardEventActions = <
  TArrays extends WorldContentArrays,
  TEventId extends WizStandardEventId<TArrays>,
>(
  origin: symbol,
  eventId: TEventId,
  choiceCount: number
): WizStandardEventActions<TArrays, TEventId> =>
  WizStandardEventActions.create<TArrays, TEventId>(
    standardEventActionsConstructionToken,
    origin,
    eventId,
    choiceCount
  )
