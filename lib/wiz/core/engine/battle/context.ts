import type { WizBattleCharacter } from "@/lib/wiz/core/engine/battle/actors/character"
import type { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import type { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import { deriveEffectiveBattleState } from "@/lib/wiz/core/engine/battle/derive-effective-battle-state"
import type { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import type { WizEngineBattleInitiativeResult } from "@/lib/wiz/core/engine/battle/types"
import { WizEntityNotFoundError } from "@/lib/wiz/core/errors"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"

type Properties<TStatus = unknown, TMonsterCustom = unknown> = {
  readonly id: string
  readonly turnNumber: number
  readonly party: WizBattleParty<TStatus>
  readonly enemies: WizBattleEnemyParty<TStatus, TMonsterCustom>
  readonly executedActions: readonly WizEngineBattleTurnAction[]
  readonly initiative: WizEngineBattleInitiativeResult
}

const objectService = new WizObjectService()

export class WizEngineBattleContext<
  TStatus = unknown,
  TMonsterCustom = unknown,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly id: string
  readonly turnNumber: number
  readonly party: WizBattleParty<TStatus>
  readonly enemies: WizBattleEnemyParty<TStatus, TMonsterCustom>
  readonly executedActions: readonly WizEngineBattleTurnAction[]
  readonly initiative: WizEngineBattleInitiativeResult

  constructor(properties: Properties<TStatus, TMonsterCustom>) {
    this.id = properties.id
    this.turnNumber = properties.turnNumber
    this.party = properties.party
    this.enemies = properties.enemies
    this.executedActions = objectService.ownImmutable(
      properties.executedActions
    )
    this.initiative = objectService.ownImmutable(properties.initiative)
    WizImmutableValue.freeze(this)
  }

  withParty(
    party: WizBattleParty<TStatus>
  ): WizEngineBattleContext<TStatus, TMonsterCustom> {
    return new WizEngineBattleContext({
      id: this.id,
      turnNumber: this.turnNumber,
      party,
      enemies: this.enemies,
      executedActions: this.executedActions,
      initiative: this.initiative,
    })
  }

  withEnemies(
    enemies: WizBattleEnemyParty<TStatus, TMonsterCustom>
  ): WizEngineBattleContext<TStatus, TMonsterCustom> {
    return new WizEngineBattleContext({
      id: this.id,
      turnNumber: this.turnNumber,
      party: this.party,
      enemies,
      executedActions: this.executedActions,
      initiative: this.initiative,
    })
  }

  withExecutedAction(
    action: WizEngineBattleTurnAction
  ): WizEngineBattleContext<TStatus, TMonsterCustom> {
    return new WizEngineBattleContext({
      id: this.id,
      turnNumber: this.turnNumber,
      party: this.party,
      enemies: this.enemies,
      executedActions: [...this.executedActions, action],
      initiative: this.initiative,
    })
  }

  withNextTurn(): WizEngineBattleContext<TStatus, TMonsterCustom> {
    // ターン終了時にステータス効果のターン数を減らす (防御など)
    const updatedParty = this.party.advanceEffects()
    const updatedEnemies = this.enemies.advanceEffects()

    return new WizEngineBattleContext({
      id: this.id,
      turnNumber: this.turnNumber + 1,
      party: updatedParty,
      enemies: updatedEnemies,
      executedActions: [],
      initiative: this.initiative,
    })
  }

  withInitiative(
    initiative: WizEngineBattleInitiativeResult
  ): WizEngineBattleContext<TStatus, TMonsterCustom> {
    return new WizEngineBattleContext({
      id: this.id,
      turnNumber: this.turnNumber,
      party: this.party,
      enemies: this.enemies,
      executedActions: this.executedActions,
      initiative,
    })
  }

  isPartyDefeated(): boolean {
    return this.party.isDefeated()
  }

  isEnemiesDefeated(): boolean {
    return this.enemies.isDefeated()
  }

  isBattleOver(): boolean {
    return this.isPartyDefeated() || this.isEnemiesDefeated()
  }

  withDamageToPartyMember(
    memberId: string,
    amount: number
  ): WizEngineBattleContext<TStatus, TMonsterCustom> {
    return this.withParty(this.party.withDamageToMember(memberId, amount))
  }

  withHealToPartyMember(
    memberId: string,
    amount: number
  ): WizEngineBattleContext<TStatus, TMonsterCustom> {
    return this.withParty(this.party.withHealToMember(memberId, amount))
  }

  withDamageToEnemy(
    monsterId: string,
    amount: number
  ): WizEngineBattleContext<TStatus, TMonsterCustom> {
    return this.withEnemies(this.enemies.withDamageToMonster(monsterId, amount))
  }

  withDamageToEnemyGroup(
    groupId: string,
    amount: number
  ): WizEngineBattleContext<TStatus, TMonsterCustom> {
    return this.withEnemies(this.enemies.withDamageToGroup(groupId, amount))
  }

  withDamageToAllEnemies(
    amount: number
  ): WizEngineBattleContext<TStatus, TMonsterCustom> {
    return this.withEnemies(this.enemies.withDamageToAll(amount))
  }

  getPartyMemberSpeed(memberId: string): number {
    const member = this.party.getMemberById(memberId)
    return member
      ? deriveEffectiveBattleState(
          member.status,
          member.effects
        ).attributes.value("speed")
      : 0
  }

  getEnemySpeed(monsterId: string): number {
    const monster = this.enemies.getMonsterById(monsterId)
    return monster
      ? deriveEffectiveBattleState(
          monster.status,
          monster.effects
        ).attributes.value("speed")
      : 0
  }

  getActorSpeed(actorId: string): number {
    const partySpeed = this.getPartyMemberSpeed(actorId)
    if (partySpeed > 0) {
      return partySpeed
    }
    return this.getEnemySpeed(actorId)
  }

  canActorAct(actorId: string): boolean {
    const partyMember = this.party.getMemberById(actorId)
    if (partyMember) {
      return partyMember.canAct()
    }
    const enemy = this.enemies.getMonsterById(actorId)
    if (enemy) {
      return enemy.canAct()
    }
    return false
  }

  isActorAlive(actorId: string): boolean {
    const partyMember = this.party.getMemberById(actorId)
    if (partyMember) {
      return partyMember.isAlive()
    }
    const enemy = this.enemies.getMonsterById(actorId)
    if (enemy) {
      return enemy.isAlive()
    }
    return false
  }

  isActorSilenced(actorId: string): boolean {
    const partyMember = this.party.getMemberById(actorId)
    if (partyMember) {
      return partyMember.isSilenced()
    }
    const enemy = this.enemies.getMonsterById(actorId)
    if (enemy) {
      return enemy.isSilenced()
    }
    return false
  }

  getActorById(
    actorId: string
  ):
    | WizBattleCharacter<TStatus>
    | WizBattleMonster<TStatus, TMonsterCustom>
    | undefined {
    const partyMember = this.party.getMemberById(actorId)
    if (partyMember) {
      return partyMember
    }
    return this.enemies.getMonsterById(actorId)
  }

  requireActorById(
    actorId: string
  ): WizBattleCharacter<TStatus> | WizBattleMonster<TStatus, TMonsterCustom> {
    const actor = this.getActorById(actorId)
    if (!actor) {
      throw new WizEntityNotFoundError("Actor", actorId)
    }
    return actor
  }

  toProperties(): Properties<TStatus, TMonsterCustom> {
    return {
      id: this.id,
      turnNumber: this.turnNumber,
      party: this.party,
      enemies: this.enemies,
      executedActions: this.executedActions,
      initiative: this.initiative,
    }
  }
}
