import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import type { WizSceneExplorationActionType } from "@/lib/wiz/core/runtime/scenes/exploration/states/state"
import { createWizStandardActionValue } from "@/lib/wiz/core/presets/standard-actions/create-wiz-standard-action-value"
import type { WizStandardActionValueFor } from "@/lib/wiz/core/presets/standard-actions/standard-action-value"
import type {
  WizStandardAreaId,
  WizStandardAreaMonsterId,
  WizStandardCheckedId,
  WizStandardCheckedIdInput,
} from "@/lib/wiz/core/presets/standard-actions/content-types"

const WIZ_STANDARD_EXPLORATION_ACTIONS: readonly WizSceneExplorationActionType[] =
  Object.freeze(["explore", "gather", "hunt", "rest"])
const standardAreaActionsConstructionToken = Symbol(
  "WizStandardAreaActions.constructor"
)

export class WizStandardAreaActions<
  TArrays extends WorldContentArrays,
  TAreaId extends WizStandardAreaId<TArrays>,
> {
  readonly areaId: TAreaId
  readonly #monsterIds: readonly string[]
  readonly #origin: symbol

  private constructor(
    token: typeof standardAreaActionsConstructionToken,
    origin: symbol,
    areaId: TAreaId,
    monsterIds: readonly string[]
  ) {
    if (token !== standardAreaActionsConstructionToken) {
      throw new TypeError(
        "WizStandardAreaActions must be created by WizStandardActions"
      )
    }
    this.#origin = origin
    this.areaId = areaId
    this.#monsterIds = Object.freeze([...monsterIds])
    Object.freeze(this)
  }

  /** @internal */
  static create<
    TArrays extends WorldContentArrays,
    TAreaId extends WizStandardAreaId<TArrays>,
  >(
    token: typeof standardAreaActionsConstructionToken,
    origin: symbol,
    areaId: TAreaId,
    monsterIds: readonly string[]
  ): WizStandardAreaActions<TArrays, TAreaId> {
    return new WizStandardAreaActions<TArrays, TAreaId>(
      token,
      origin,
      areaId,
      monsterIds
    )
  }

  enter() {
    return createWizStandardActionValue(this.#origin, {
      type: "GO_TO_EXPLORATION",
      areaId: this.areaId,
    })
  }

  act<const TCandidate extends string>(
    action: WizStandardCheckedIdInput<TCandidate, WizSceneExplorationActionType>
  ): WizStandardActionValueFor<{
    type: "EXPLORATION_ACTION"
    areaId: TAreaId
    action: WizStandardCheckedId<TCandidate, WizSceneExplorationActionType>
  }>
  act(action: string) {
    const knownAction = WIZ_STANDARD_EXPLORATION_ACTIONS.find(
      (candidate) => candidate === action
    )
    if (knownAction === undefined) {
      throw new RangeError(`Unknown standard exploration action "${action}"`)
    }
    return createWizStandardActionValue(this.#origin, {
      type: "EXPLORATION_ACTION",
      areaId: this.areaId,
      action: knownAction,
    })
  }

  encounter<const TCandidate extends string>(
    monsterId: WizStandardCheckedIdInput<
      TCandidate,
      WizStandardAreaMonsterId<TArrays, TAreaId>
    >
  ): WizStandardActionValueFor<{
    type: "ENCOUNTER_MONSTER"
    areaId: TAreaId
    monsterId: WizStandardCheckedId<
      TCandidate,
      WizStandardAreaMonsterId<TArrays, TAreaId>
    >
  }>
  encounter(monsterId: string) {
    if (!this.#monsterIds.includes(monsterId)) {
      throw new RangeError(
        `Monster "${monsterId}" is not defined for standard area "${this.areaId}"`
      )
    }
    return createWizStandardActionValue(this.#origin, {
      type: "ENCOUNTER_MONSTER",
      areaId: this.areaId,
      monsterId,
    })
  }
}

Object.freeze(WizStandardAreaActions.prototype)
Object.freeze(WizStandardAreaActions)

/** @internal */
export const createWizStandardAreaActions = <
  TArrays extends WorldContentArrays,
  TAreaId extends WizStandardAreaId<TArrays>,
>(
  origin: symbol,
  areaId: TAreaId,
  monsterIds: readonly string[]
): WizStandardAreaActions<TArrays, TAreaId> =>
  WizStandardAreaActions.create<TArrays, TAreaId>(
    standardAreaActionsConstructionToken,
    origin,
    areaId,
    monsterIds
  )
