import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import { createWizStandardActionValue } from "@/lib/wiz/core/presets/standard-actions/create-wiz-standard-action-value"
import type { WizStandardQuestId } from "@/lib/wiz/core/presets/standard-actions/content-types"

const standardQuestActionsConstructionToken = Symbol(
  "WizStandardQuestActions.constructor"
)

export class WizStandardQuestActions<
  TArrays extends WorldContentArrays,
  TQuestId extends WizStandardQuestId<TArrays>,
> {
  readonly questId: TQuestId
  readonly #origin: symbol

  private constructor(
    token: typeof standardQuestActionsConstructionToken,
    origin: symbol,
    questId: TQuestId
  ) {
    if (token !== standardQuestActionsConstructionToken) {
      throw new TypeError(
        "WizStandardQuestActions must be created by WizStandardActions"
      )
    }
    this.#origin = origin
    this.questId = questId
    Object.freeze(this)
  }

  /** @internal */
  static create<
    TArrays extends WorldContentArrays,
    TQuestId extends WizStandardQuestId<TArrays>,
  >(
    token: typeof standardQuestActionsConstructionToken,
    origin: symbol,
    questId: TQuestId
  ): WizStandardQuestActions<TArrays, TQuestId> {
    return new WizStandardQuestActions<TArrays, TQuestId>(
      token,
      origin,
      questId
    )
  }

  select() {
    return createWizStandardActionValue(this.#origin, {
      type: "SELECT_QUEST",
      questId: this.questId,
    })
  }
}

Object.freeze(WizStandardQuestActions.prototype)
Object.freeze(WizStandardQuestActions)

/** @internal */
export const createWizStandardQuestActions = <
  TArrays extends WorldContentArrays,
  TQuestId extends WizStandardQuestId<TArrays>,
>(
  origin: symbol,
  questId: TQuestId
): WizStandardQuestActions<TArrays, TQuestId> =>
  WizStandardQuestActions.create<TArrays, TQuestId>(
    standardQuestActionsConstructionToken,
    origin,
    questId
  )
