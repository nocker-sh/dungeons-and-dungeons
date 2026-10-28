import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import { createWizStandardActionValue } from "@/lib/wiz/core/presets/standard-actions/create-wiz-standard-action-value"
import type { WizStandardActionValueFor } from "@/lib/wiz/core/presets/standard-actions/standard-action-value"
import type {
  WizStandardCheckedId,
  WizStandardCheckedIdInput,
  WizStandardDialogueId,
  WizStandardDialogueOptionId,
  WizStandardNpcId,
} from "@/lib/wiz/core/presets/standard-actions/content-types"

const standardDialogueActionsConstructionToken = Symbol(
  "WizStandardDialogueActions.constructor"
)

export class WizStandardDialogueActions<
  TArrays extends WorldContentArrays,
  TNpcId extends WizStandardNpcId<TArrays>,
  TDialogueId extends WizStandardDialogueId<TArrays, TNpcId>,
> {
  readonly npcId: TNpcId
  readonly dialogueId: TDialogueId
  readonly #optionIds: readonly string[]
  readonly #origin: symbol

  private constructor(
    token: typeof standardDialogueActionsConstructionToken,
    origin: symbol,
    npcId: TNpcId,
    dialogueId: TDialogueId,
    optionIds: readonly string[]
  ) {
    if (token !== standardDialogueActionsConstructionToken) {
      throw new TypeError(
        "WizStandardDialogueActions must be created by WizStandardNpcActions"
      )
    }
    this.#origin = origin
    this.npcId = npcId
    this.dialogueId = dialogueId
    this.#optionIds = Object.freeze([...optionIds])
    Object.freeze(this)
  }

  /** @internal */
  static create<
    TArrays extends WorldContentArrays,
    TNpcId extends WizStandardNpcId<TArrays>,
    TDialogueId extends WizStandardDialogueId<TArrays, TNpcId>,
  >(
    token: typeof standardDialogueActionsConstructionToken,
    origin: symbol,
    npcId: TNpcId,
    dialogueId: TDialogueId,
    optionIds: readonly string[]
  ): WizStandardDialogueActions<TArrays, TNpcId, TDialogueId> {
    return new WizStandardDialogueActions<TArrays, TNpcId, TDialogueId>(
      token,
      origin,
      npcId,
      dialogueId,
      optionIds
    )
  }

  choose<const TCandidate extends string>(
    optionId: WizStandardCheckedIdInput<
      TCandidate,
      WizStandardDialogueOptionId<TArrays, TNpcId, TDialogueId>
    >
  ): WizStandardActionValueFor<{
    type: "SELECT_DIALOGUE_OPTION"
    npcId: TNpcId
    dialogueId: TDialogueId
    optionId: WizStandardCheckedId<
      TCandidate,
      WizStandardDialogueOptionId<TArrays, TNpcId, TDialogueId>
    >
  }>
  choose(optionId: string) {
    if (!this.#optionIds.includes(optionId)) {
      throw new RangeError(
        `Unknown option "${optionId}" for standard dialogue "${String(this.dialogueId)}"`
      )
    }
    return createWizStandardActionValue(this.#origin, {
      type: "SELECT_DIALOGUE_OPTION",
      npcId: this.npcId,
      dialogueId: this.dialogueId,
      optionId,
    })
  }
}

Object.freeze(WizStandardDialogueActions.prototype)
Object.freeze(WizStandardDialogueActions)

/** @internal */
export const createWizStandardDialogueActions = <
  TArrays extends WorldContentArrays,
  TNpcId extends WizStandardNpcId<TArrays>,
  TDialogueId extends WizStandardDialogueId<TArrays, TNpcId>,
>(
  origin: symbol,
  npcId: TNpcId,
  dialogueId: TDialogueId,
  optionIds: readonly string[]
): WizStandardDialogueActions<TArrays, TNpcId, TDialogueId> =>
  WizStandardDialogueActions.create<TArrays, TNpcId, TDialogueId>(
    standardDialogueActionsConstructionToken,
    origin,
    npcId,
    dialogueId,
    optionIds
  )
