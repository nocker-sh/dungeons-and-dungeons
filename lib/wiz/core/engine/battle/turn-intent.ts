import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import type { WizEngineBattleTurnActionType } from "@/lib/wiz/core/engine/battle/types"

const battleTurnIntentConstructionToken = Symbol(
  "WizEngineBattleTurnIntent.constructor"
)
const authenticBattleTurnIntents = new WeakSet<object>()

type WizEngineBattleTurnIntentProperties<
  TType extends WizEngineBattleTurnActionType,
  TActorId extends string,
  TTargetIds extends readonly string[],
  TAbilityId extends string | null,
  TItemId extends string | null,
> = Readonly<{
  type: TType
  actorId: TActorId
  targetIds: TTargetIds
  abilityId: TAbilityId
  itemId: TItemId
}>

/**
 * ID採番前の純粋なbattle command。
 *
 * 生成時にはenvironmentへ触れず、world transaction内のmaterialize時だけaction IDを受け取る。
 */
export class WizEngineBattleTurnIntent<
  TType extends WizEngineBattleTurnActionType = WizEngineBattleTurnActionType,
  TActorId extends string = string,
  TTargetIds extends readonly string[] = readonly string[],
  TAbilityId extends string | null = string | null,
  TItemId extends string | null = string | null,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type: TType
  readonly actorId: TActorId
  readonly targetIds: WizDeepReadonly<TTargetIds>
  readonly abilityId: TAbilityId
  readonly itemId: TItemId

  private constructor(
    token: typeof battleTurnIntentConstructionToken,
    properties: WizEngineBattleTurnIntentProperties<
      TType,
      TActorId,
      TTargetIds,
      TAbilityId,
      TItemId
    >
  ) {
    if (token !== battleTurnIntentConstructionToken) {
      throw new TypeError(
        "WizEngineBattleTurnIntent must be created with attack(), defend(), flee(), ability(), or item()"
      )
    }
    WizEngineBattleTurnAction.fromUnknown({
      id: "turn-intent-validation",
      type: properties.type,
      actorId: properties.actorId,
      targetIds: properties.targetIds,
      abilityId: properties.abilityId,
      itemId: properties.itemId,
    })
    this.type = properties.type
    this.actorId = properties.actorId
    this.targetIds = new WizObjectService().ownImmutable(properties.targetIds)
    this.abilityId = properties.abilityId
    this.itemId = properties.itemId
    authenticBattleTurnIntents.add(this)
    WizImmutableValue.freeze(this)
  }

  static assertAuthentic(
    intent: unknown
  ): asserts intent is WizEngineBattleTurnIntent {
    if (
      typeof intent !== "object" ||
      intent === null ||
      !authenticBattleTurnIntents.has(intent)
    ) {
      throw new TypeError(
        "Battle turn intent must be created by WizEngineBattleTurnIntent factories"
      )
    }
  }

  static attack<const TActorId extends string, const TTargetId extends string>(
    actorId: TActorId,
    targetId: TTargetId
  ): WizEngineBattleTurnIntent<
    "attack",
    TActorId,
    readonly [TTargetId],
    null,
    null
  > {
    return new WizEngineBattleTurnIntent<
      "attack",
      TActorId,
      readonly [TTargetId],
      null,
      null
    >(battleTurnIntentConstructionToken, {
      type: "attack",
      actorId,
      targetIds: [targetId],
      abilityId: null,
      itemId: null,
    })
  }

  static defend<const TActorId extends string>(
    actorId: TActorId
  ): WizEngineBattleTurnIntent<
    "defend",
    TActorId,
    readonly [TActorId],
    null,
    null
  > {
    return new WizEngineBattleTurnIntent<
      "defend",
      TActorId,
      readonly [TActorId],
      null,
      null
    >(battleTurnIntentConstructionToken, {
      type: "defend",
      actorId,
      targetIds: [actorId],
      abilityId: null,
      itemId: null,
    })
  }

  static flee<const TActorId extends string>(
    actorId: TActorId
  ): WizEngineBattleTurnIntent<"flee", TActorId, readonly [], null, null> {
    return new WizEngineBattleTurnIntent<
      "flee",
      TActorId,
      readonly [],
      null,
      null
    >(battleTurnIntentConstructionToken, {
      type: "flee",
      actorId,
      targetIds: [],
      abilityId: null,
      itemId: null,
    })
  }

  static ability<
    const TActorId extends string,
    const TAbilityId extends string,
    const TTargetIds extends readonly string[],
  >(
    actorId: TActorId,
    abilityId: TAbilityId,
    targetIds: number extends TTargetIds["length"]
      ? TTargetIds
      : TTargetIds extends readonly [string, ...string[]]
        ? TTargetIds
        : never
  ): WizEngineBattleTurnIntent<
    "ability",
    TActorId,
    TTargetIds,
    TAbilityId,
    null
  > {
    return new WizEngineBattleTurnIntent<
      "ability",
      TActorId,
      TTargetIds,
      TAbilityId,
      null
    >(battleTurnIntentConstructionToken, {
      type: "ability",
      actorId,
      targetIds,
      abilityId,
      itemId: null,
    })
  }

  static item<
    const TActorId extends string,
    const TItemId extends string,
    const TTargetIds extends readonly string[],
  >(
    actorId: TActorId,
    itemId: TItemId,
    targetIds: number extends TTargetIds["length"]
      ? TTargetIds
      : TTargetIds extends readonly [string, ...string[]]
        ? TTargetIds
        : never
  ): WizEngineBattleTurnIntent<"item", TActorId, TTargetIds, null, TItemId> {
    return new WizEngineBattleTurnIntent<
      "item",
      TActorId,
      TTargetIds,
      null,
      TItemId
    >(battleTurnIntentConstructionToken, {
      type: "item",
      actorId,
      targetIds,
      abilityId: null,
      itemId,
    })
  }
}

Object.freeze(WizEngineBattleTurnIntent.prototype)
Object.freeze(WizEngineBattleTurnIntent)

export function materializeWizEngineBattleTurnIntent<
  const TActionId extends string,
>(
  intent: WizEngineBattleTurnIntent,
  actionId: TActionId
): WizEngineBattleTurnAction {
  WizEngineBattleTurnIntent.assertAuthentic(intent)

  switch (intent.type) {
    case "attack":
      return WizEngineBattleTurnAction.attackMultiple(
        intent.actorId,
        intent.targetIds,
        actionId
      )
    case "defend":
      return WizEngineBattleTurnAction.defend(intent.actorId, actionId)
    case "flee":
      return WizEngineBattleTurnAction.flee(intent.actorId, actionId)
    case "ability": {
      if (intent.abilityId === null) {
        throw new TypeError("Battle ability intent requires abilityId")
      }
      return WizEngineBattleTurnAction.ability(
        intent.actorId,
        intent.abilityId,
        intent.targetIds,
        actionId
      )
    }
    case "item": {
      if (intent.itemId === null) {
        throw new TypeError("Battle item intent requires itemId")
      }
      return WizEngineBattleTurnAction.item(
        intent.actorId,
        intent.itemId,
        intent.targetIds,
        actionId
      )
    }
  }
}
