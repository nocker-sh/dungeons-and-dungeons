import {
  WizEngineBattleTurnAction,
  type WizEngineBattleTurnActionValue,
} from "@/lib/wiz/core/engine/battle/turn-action"
import { WizIdGenerator } from "@/lib/wiz/core/services/wiz-id-generator"

export type WizEngineBattleActionBuilderDefinition = Readonly<{
  readonly nextId?: () => string
}>

/** ID source を注入できる immutable action builder。 */
export class WizEngineBattleActionBuilder {
  private readonly nextId: () => string

  constructor(properties: WizEngineBattleActionBuilderDefinition = {}) {
    const generator =
      properties.nextId === undefined
        ? new WizIdGenerator()
        : new WizIdGenerator({ source: properties.nextId })
    this.nextId = Object.freeze(generator.next.bind(generator))
    Object.freeze(this)
  }

  attack<const TActorId extends string, const TTargetId extends string>(
    actorId: TActorId,
    targetId: TTargetId,
  ): WizEngineBattleTurnActionValue<"attack", string, TActorId, readonly [TTargetId], null, null> {
    return WizEngineBattleTurnAction.attack(actorId, targetId, this.nextId())
  }

  defend<const TActorId extends string>(
    actorId: TActorId,
  ): WizEngineBattleTurnActionValue<"defend", string, TActorId, readonly [TActorId], null, null> {
    return WizEngineBattleTurnAction.defend(actorId, this.nextId())
  }

  flee<const TActorId extends string>(
    actorId: TActorId,
  ): WizEngineBattleTurnActionValue<"flee", string, TActorId, readonly [], null, null> {
    return WizEngineBattleTurnAction.flee(actorId, this.nextId())
  }

  ability<
    const TActorId extends string,
    const TAbilityId extends string,
    const TTargetIds extends readonly string[],
  >(
    actorId: TActorId,
    abilityId: TAbilityId,
    targetIds: TTargetIds,
  ): WizEngineBattleTurnActionValue<"ability", string, TActorId, TTargetIds, TAbilityId, null> {
    return WizEngineBattleTurnAction.ability(actorId, abilityId, targetIds, this.nextId())
  }

  item<
    const TActorId extends string,
    const TItemId extends string,
    const TTargetIds extends readonly string[],
  >(
    actorId: TActorId,
    itemId: TItemId,
    targetIds: TTargetIds,
  ): WizEngineBattleTurnActionValue<"item", string, TActorId, TTargetIds, null, TItemId> {
    return WizEngineBattleTurnAction.item(actorId, itemId, targetIds, this.nextId())
  }
}

Object.freeze(WizEngineBattleActionBuilder.prototype)
Object.freeze(WizEngineBattleActionBuilder)
