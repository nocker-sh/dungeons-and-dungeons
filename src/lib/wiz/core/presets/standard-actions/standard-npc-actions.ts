import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import { createWizStandardActionValue } from "@/lib/wiz/core/presets/standard-actions/standard-action-value"
import {
  createWizStandardDialogueActions,
  WizStandardDialogueActions,
} from "@/lib/wiz/core/presets/standard-actions/standard-dialogue-actions"
import type {
  WizStandardCheckedId,
  WizStandardCheckedIdInput,
  WizStandardDialogueId,
  WizStandardNpcId,
} from "@/lib/wiz/core/presets/standard-actions/content-types"

type WizStandardNpcDialogueDefinition = Readonly<{
  id: string
  options?: readonly Readonly<{ id: string }>[]
}>
const standardNpcActionsConstructionToken = Symbol("WizStandardNpcActions.constructor")

export class WizStandardNpcActions<
  TArrays extends WorldContentArrays,
  TNpcId extends WizStandardNpcId<TArrays>,
> {
  readonly npcId: TNpcId
  readonly #dialogues: readonly WizStandardNpcDialogueDefinition[]
  readonly #origin: symbol

  private constructor(
    token: typeof standardNpcActionsConstructionToken,
    origin: symbol,
    npcId: TNpcId,
    dialogues: readonly WizStandardNpcDialogueDefinition[],
  ) {
    if (token !== standardNpcActionsConstructionToken) {
      throw new TypeError("WizStandardNpcActions must be created by WizStandardActions")
    }
    this.#origin = origin
    this.npcId = npcId
    this.#dialogues = Object.freeze(
      dialogues.map((dialogue) =>
        Object.freeze({
          id: dialogue.id,
          ...(dialogue.options === undefined
            ? {}
            : {
                options: Object.freeze(
                  dialogue.options.map((option) => Object.freeze({ id: option.id })),
                ),
              }),
        }),
      ),
    )
    Object.freeze(this)
  }

  /** @internal */
  static create<TArrays extends WorldContentArrays, TNpcId extends WizStandardNpcId<TArrays>>(
    token: typeof standardNpcActionsConstructionToken,
    origin: symbol,
    npcId: TNpcId,
    dialogues: readonly WizStandardNpcDialogueDefinition[],
  ): WizStandardNpcActions<TArrays, TNpcId> {
    return new WizStandardNpcActions<TArrays, TNpcId>(token, origin, npcId, dialogues)
  }

  talk() {
    return createWizStandardActionValue(this.#origin, {
      type: "TALK_TO_NPC",
      npcId: this.npcId,
    })
  }

  dialogue<const TCandidate extends string>(
    dialogueId: WizStandardCheckedIdInput<TCandidate, WizStandardDialogueId<TArrays, TNpcId>>,
  ): WizStandardDialogueActions<
    TArrays,
    TNpcId,
    WizStandardCheckedId<TCandidate, WizStandardDialogueId<TArrays, TNpcId>>
  >
  dialogue(
    dialogueId: string,
  ): WizStandardDialogueActions<TArrays, TNpcId, WizStandardDialogueId<TArrays, TNpcId>> {
    const dialogue = this.#dialogues.find(
      (
        candidate,
      ): candidate is WizStandardNpcDialogueDefinition &
        Readonly<{ id: WizStandardDialogueId<TArrays, TNpcId> }> => candidate.id === dialogueId,
    )
    if (!dialogue) {
      throw new RangeError(`Unknown dialogue "${dialogueId}" for standard NPC "${this.npcId}"`)
    }
    return createWizStandardDialogueActions<
      TArrays,
      TNpcId,
      WizStandardDialogueId<TArrays, TNpcId>
    >(this.#origin, this.npcId, dialogue.id, dialogue.options?.map((option) => option.id) ?? [])
  }
}

Object.freeze(WizStandardNpcActions.prototype)
Object.freeze(WizStandardNpcActions)

/** @internal */
export const createWizStandardNpcActions = <
  TArrays extends WorldContentArrays,
  TNpcId extends WizStandardNpcId<TArrays>,
>(
  origin: symbol,
  npcId: TNpcId,
  dialogues: readonly WizStandardNpcDialogueDefinition[],
): WizStandardNpcActions<TArrays, TNpcId> =>
  WizStandardNpcActions.create<TArrays, TNpcId>(
    standardNpcActionsConstructionToken,
    origin,
    npcId,
    dialogues,
  )
