import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import { WizEngineBattleTurnIntent } from "@/lib/wiz/core/engine/battle/turn-intent"
import {
  createWizStandardActionValue,
  type WizStandardActionValueFor,
} from "@/lib/wiz/core/presets/standard-actions/standard-action-value"
import type {
  WizStandardBattleItemId,
  WizStandardCheckedId,
  WizStandardCheckedIdInput,
  WizStandardContentId,
} from "@/lib/wiz/core/presets/standard-actions/content-types"

const standardBattleActionsConstructionToken = Symbol("WizStandardBattleActions.constructor")

export class WizStandardBattleActions<TArrays extends WorldContentArrays> {
  readonly #itemIds: readonly string[]
  readonly #origin: symbol
  readonly #abilityIds: readonly string[]

  private constructor(
    token: typeof standardBattleActionsConstructionToken,
    origin: symbol,
    abilityIds: readonly string[],
    itemIds: readonly string[],
  ) {
    if (token !== standardBattleActionsConstructionToken) {
      throw new TypeError("WizStandardBattleActions must be created by WizStandardActions")
    }
    this.#origin = origin
    this.#abilityIds = Object.freeze([...abilityIds])
    this.#itemIds = Object.freeze([...itemIds])
    Object.freeze(this)
  }

  /** @internal */
  static create<TArrays extends WorldContentArrays>(
    token: typeof standardBattleActionsConstructionToken,
    origin: symbol,
    abilityIds: readonly string[],
    itemIds: readonly string[],
  ): WizStandardBattleActions<TArrays> {
    return new WizStandardBattleActions<TArrays>(token, origin, abilityIds, itemIds)
  }

  attack<const TActorId extends string, const TTargetId extends string>(
    actorId: TActorId,
    targetId: TTargetId,
  ) {
    return createWizStandardActionValue(this.#origin, {
      type: "BATTLE_EXECUTE_INTENT",
      intent: WizEngineBattleTurnIntent.attack(actorId, targetId),
    })
  }

  defend<const TActorId extends string>(actorId: TActorId) {
    return createWizStandardActionValue(this.#origin, {
      type: "BATTLE_EXECUTE_INTENT",
      intent: WizEngineBattleTurnIntent.defend(actorId),
    })
  }

  flee<const TActorId extends string>(actorId: TActorId) {
    return createWizStandardActionValue(this.#origin, {
      type: "BATTLE_EXECUTE_INTENT",
      intent: WizEngineBattleTurnIntent.flee(actorId),
    })
  }

  useAbility<
    const TActorId extends string,
    const TCandidate extends string,
    const TTargetIds extends readonly string[],
  >(
    actorId: TActorId,
    abilityId: WizStandardCheckedIdInput<TCandidate, WizStandardContentId<TArrays, "abilities">>,
    targetIds: number extends TTargetIds["length"]
      ? TTargetIds
      : TTargetIds extends readonly [string, ...string[]]
        ? TTargetIds
        : never,
  ): WizStandardActionValueFor<{
    type: "BATTLE_EXECUTE_INTENT"
    intent: WizEngineBattleTurnIntent<
      "ability",
      TActorId,
      TTargetIds,
      WizStandardCheckedId<TCandidate, WizStandardContentId<TArrays, "abilities">>,
      null
    >
  }>
  useAbility(actorId: string, abilityId: string, targetIds: readonly string[]) {
    if (!this.#abilityIds.includes(abilityId)) {
      throw new RangeError(`Unknown standard battle ability "${abilityId}"`)
    }
    return createWizStandardActionValue(this.#origin, {
      type: "BATTLE_EXECUTE_INTENT",
      intent: WizEngineBattleTurnIntent.ability(actorId, abilityId, targetIds),
    })
  }

  useItem<
    const TActorId extends string,
    const TCandidate extends string,
    const TTargetIds extends readonly string[],
  >(
    actorId: TActorId,
    itemId: WizStandardCheckedIdInput<TCandidate, WizStandardBattleItemId<TArrays>>,
    targetIds: number extends TTargetIds["length"]
      ? TTargetIds
      : TTargetIds extends readonly [string, ...string[]]
        ? TTargetIds
        : never,
  ): WizStandardActionValueFor<{
    type: "BATTLE_EXECUTE_INTENT"
    intent: WizEngineBattleTurnIntent<
      "item",
      TActorId,
      TTargetIds,
      null,
      WizStandardCheckedId<TCandidate, WizStandardBattleItemId<TArrays>>
    >
  }>
  useItem(actorId: string, itemId: string, targetIds: readonly string[]) {
    if (!this.#itemIds.includes(itemId)) {
      throw new RangeError(`Unknown standard battle item "${itemId}"`)
    }
    return createWizStandardActionValue(this.#origin, {
      type: "BATTLE_EXECUTE_INTENT",
      intent: WizEngineBattleTurnIntent.item(actorId, itemId, targetIds),
    })
  }

  start() {
    return createWizStandardActionValue(this.#origin, { type: "BATTLE_START" })
  }

  requestFlee() {
    return createWizStandardActionValue(this.#origin, { type: "BATTLE_FLEE" })
  }

  executeEnemyTurn() {
    return createWizStandardActionValue(this.#origin, {
      type: "BATTLE_EXECUTE_ENEMY_TURN",
    })
  }

  end() {
    return createWizStandardActionValue(this.#origin, { type: "BATTLE_END" })
  }
}

Object.freeze(WizStandardBattleActions.prototype)
Object.freeze(WizStandardBattleActions)

/** @internal */
export const createWizStandardBattleActions = <TArrays extends WorldContentArrays>(
  origin: symbol,
  abilityIds: readonly string[],
  itemIds: readonly string[],
): WizStandardBattleActions<TArrays> =>
  WizStandardBattleActions.create<TArrays>(
    standardBattleActionsConstructionToken,
    origin,
    abilityIds,
    itemIds,
  )
