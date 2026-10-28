import type { WizEngineBattleContext } from "@/lib/wiz/core/engine/battle/context"
import type { WizEngineBattleTurnOrderPolicy } from "@/lib/wiz/core/engine/battle/phases/turn-order"

/**
 * 派生speedの降順でactorを並べる標準policy。
 */
export class WizEngineBattleDefaultTurnOrderPolicy<
  TStatus = unknown,
  TCustom = unknown,
> implements WizEngineBattleTurnOrderPolicy<TStatus, TCustom> {
  constructor() {
    Object.freeze(this)
  }

  readonly order = (context: WizEngineBattleContext<TStatus, TCustom>): readonly string[] => {
    const partyActors = context.party.getActableMembers().map((character) => ({
      id: character.id,
      speed: context.getActorSpeed(character.id),
    }))
    const enemyActors = context.enemies.getAllAliveMonsters().map((monster) => ({
      id: monster.id,
      speed: context.getActorSpeed(monster.id),
    }))

    return Object.freeze(
      [...partyActors, ...enemyActors]
        .toSorted((first, second) => second.speed - first.speed)
        .map((actor) => actor.id),
    )
  }
}

Object.freeze(WizEngineBattleDefaultTurnOrderPolicy.prototype)
Object.freeze(WizEngineBattleDefaultTurnOrderPolicy)
