import type { WizBattleAbility } from "@/lib/wiz/core/engine/battle/ability"
import {
  DEFAULT_EFFECT_CONFIG,
  type WizEffectConfig,
} from "@/lib/wiz/core/config/battle/wiz-effect-config"
import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import type { WizBattleCharacter } from "@/lib/wiz/core/engine/battle/actors/character"
import type { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import type { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import { createBattleEffect } from "@/lib/wiz/core/engine/battle/create-battle-effect"
import { deriveEffectiveBattleState } from "@/lib/wiz/core/engine/battle/derive-effective-battle-state"
import { getBattleAbilityEffectId } from "@/lib/wiz/core/engine/battle/get-battle-ability-effect-id"
import { getBattleEffectInitialTurns } from "@/lib/wiz/core/engine/battle/get-battle-effect-initial-turns"
import {
  WizIdGenerator,
  type WizIdSource,
} from "@/lib/wiz/core/services/wiz-id-generator"
import { WizEngineBattleExecutionResult } from "@/lib/wiz/core/engine/battle/execution/execution-result"
import type {
  WizEngineBattleDamageCalculator,
  WizEngineBattleDamageContext,
} from "@/lib/wiz/core/engine/damage/default-damage-calculator"
import { WizEngineBattleDefaultDamageCalculator } from "@/lib/wiz/core/engine/damage/default-damage-calculator"
import {
  WizBattleLog,
  type WizLogMessage,
} from "@/lib/wiz/core/types/wiz-log-message"

type AbilityExecutionOptions = {
  readonly weatherBonus?: number
  readonly abilityPowerMultiplier?: number
}

type Properties<TStatus = unknown> = {
  readonly damageCalculator?: WizEngineBattleDamageCalculator<TStatus>
  readonly idGenerator?: WizIdSource
  readonly effectConfig?: WizEffectConfig
}

export class WizEngineBattleAbilityExecutor<
  TStatus = unknown,
  TCustom = unknown,
> {
  readonly damageCalculator: WizEngineBattleDamageCalculator<TStatus>
  private readonly idGenerator: WizIdSource
  private readonly effectConfig: WizEffectConfig

  constructor(properties: Properties<TStatus> = {}) {
    this.damageCalculator =
      properties.damageCalculator ??
      new WizEngineBattleDefaultDamageCalculator()
    this.idGenerator = properties.idGenerator ?? new WizIdGenerator()
    this.effectConfig = immutableConfig(
      properties.effectConfig ?? DEFAULT_EFFECT_CONFIG
    )
    Object.freeze(this)
  }

  execute(
    ability: WizBattleAbility,
    actorId: string,
    targetIds: readonly string[],
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
    options: AbilityExecutionOptions = {}
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    const logs: WizLogMessage[] = []
    let currentParty = party
    let currentEnemies = enemies

    const actor = this.findActor(actorId, party, enemies)
    const manaCost = ability.costs.mana ?? 0
    if (!actor?.canAct() || actor.isSilenced() || !actor.hasMp(manaCost)) {
      return WizEngineBattleExecutionResult.reject({
        party: currentParty,
        enemies: currentEnemies,
        reason: "BATTLE_ACTION_REJECTED",
      })
    }

    // Consume MP
    const isPartyActor = this.isPartyMember(actorId, party)
    if (isPartyActor) {
      const member = currentParty.getMemberById(actorId)
      if (member) {
        currentParty = currentParty.withMember(member.withMpCost(manaCost))
      }
    }

    const firstTargetId = targetIds[0]
    if (
      !firstTargetId ||
      !this.findActor(firstTargetId, currentParty, currentEnemies)
    ) {
      return WizEngineBattleExecutionResult.reject({
        party,
        enemies,
        reason: "BATTLE_ACTION_REJECTED",
      })
    }

    logs.push(WizBattleLog.ability(actorId, ability.id, firstTargetId))

    if (ability.effect.type === "damage") {
      const damageResult = this.executeDamage(
        ability,
        actor,
        targetIds,
        currentParty,
        currentEnemies,
        options.weatherBonus ?? 0,
        options.abilityPowerMultiplier ?? 1.0
      )
      currentParty = damageResult.party
      currentEnemies = damageResult.enemies
      logs.push(...damageResult.logs)
    }

    if (ability.effect.type === "heal") {
      const healResult = this.executeHeal(
        ability,
        actorId,
        targetIds,
        currentParty,
        currentEnemies
      )
      currentParty = healResult.party
      currentEnemies = healResult.enemies
      logs.push(...healResult.logs)
    }

    if (ability.effect.type === "effect") {
      const statusResult = this.executeEffect(
        ability,
        actorId,
        targetIds,
        currentParty,
        currentEnemies
      )
      currentParty = statusResult.party
      currentEnemies = statusResult.enemies
      logs.push(...statusResult.logs)
    }

    return WizEngineBattleExecutionResult.accept({
      party: currentParty,
      enemies: currentEnemies,
      logs,
      success: true,
    })
  }

  private executeDamage(
    ability: WizBattleAbility,
    actor: WizBattleCharacter<TStatus> | WizBattleMonster<TStatus, TCustom>,
    targetIds: readonly string[],
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
    weatherBonus: number,
    abilityPowerMultiplier: number
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    const logs: WizLogMessage[] = []
    let currentParty = party
    let currentEnemies = enemies

    for (const targetId of targetIds) {
      const target = this.findActor(targetId, currentParty, currentEnemies)
      if (!target) continue

      const context: WizEngineBattleDamageContext = {
        abilityId: ability.id,
        element: ability.effect.element,
        defenderAffinity: {},
        isBackAttack: false,
        isCriticalGuaranteed: false,
        isDefending: target.isDefending(),
        weatherBonus,
        abilityPowerMultiplier,
      }

      const effectiveActorStatus = deriveEffectiveBattleState(
        actor.status,
        actor.effects
      )
      const attackerStatus = effectiveActorStatus.withAttributes(
        effectiveActorStatus.attributes.add("attack", ability.effect.power)
      )
      const damageResult = this.damageCalculator.calculate({
        attacker: attackerStatus,
        defender: deriveEffectiveBattleState(target.status, target.effects),
        context,
      })

      if (damageResult.isEvaded) {
        logs.push(WizBattleLog.miss(actor.id, targetId))
        continue
      }

      if (damageResult.isCritical) {
        logs.push(
          WizBattleLog.critical(actor.id, targetId, damageResult.damage)
        )
      }

      logs.push(WizBattleLog.damage(targetId, damageResult.damage))

      const isTargetPartyMember = this.isPartyMember(targetId, currentParty)
      if (isTargetPartyMember) {
        currentParty = currentParty.withDamageToMember(
          targetId,
          damageResult.damage
        )
        const updatedTarget = currentParty.getMemberById(targetId)
        if (updatedTarget?.isDead()) {
          logs.push(WizBattleLog.death(targetId))
        }
      } else {
        currentEnemies = currentEnemies.withDamageToMonster(
          targetId,
          damageResult.damage
        )
        const updatedTarget = currentEnemies.getMonsterById(targetId)
        if (updatedTarget?.isDead()) {
          logs.push(WizBattleLog.death(targetId))
        }
      }
    }

    return WizEngineBattleExecutionResult.accept({
      party: currentParty,
      enemies: currentEnemies,
      logs,
      success: true,
    })
  }

  private executeHeal(
    ability: WizBattleAbility,
    _actorId: string,
    targetIds: readonly string[],
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    const logs: WizLogMessage[] = []
    let currentParty = party
    let currentEnemies = enemies

    for (const targetId of targetIds) {
      const target = this.findActor(targetId, currentParty, currentEnemies)
      if (!target) continue

      const isTargetPartyMember = this.isPartyMember(targetId, currentParty)

      if (isTargetPartyMember) {
        currentParty = currentParty.withHealToMember(
          targetId,
          ability.effect.power
        )
        logs.push(WizBattleLog.heal(targetId, ability.effect.power))
      } else {
        currentEnemies = currentEnemies.withHealToMonster(
          targetId,
          ability.effect.power
        )
        logs.push(WizBattleLog.heal(targetId, ability.effect.power))
      }
    }

    return WizEngineBattleExecutionResult.accept({
      party: currentParty,
      enemies: currentEnemies,
      logs,
      success: true,
    })
  }

  private executeEffect(
    ability: WizBattleAbility,
    _actorId: string,
    targetIds: readonly string[],
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    const logs: WizLogMessage[] = []
    let currentParty = party
    let currentEnemies = enemies

    if (ability.effect.type !== "effect") {
      return WizEngineBattleExecutionResult.reject({
        party,
        enemies,
        reason: "BATTLE_ACTION_REJECTED",
      })
    }
    const abilityEffect = ability.effect
    const effectId = getBattleAbilityEffectId(ability)
    for (const targetId of targetIds) {
      const target = this.findActor(targetId, currentParty, currentEnemies)
      if (!target) continue

      const effect = createBattleEffect({
        instanceId: `${ability.id}-${targetId}-${this.idGenerator.next()}`,
        effectId,
        source: { kind: "ability", id: ability.id },
        name: ability.name,
        lifetime: {
          type: "turns",
          remaining:
            abilityEffect.durationTurns ??
            getBattleEffectInitialTurns(effectId, this.effectConfig),
        },
        power: abilityEffect.power,
        modifier: abilityEffect.modifier,
        tags: abilityEffect.tags,
        custom: ability.custom,
      })

      const isTargetPartyMember = this.isPartyMember(targetId, currentParty)

      if (isTargetPartyMember) {
        currentParty = currentParty.withEffectToMember(targetId, effect)
      } else {
        currentEnemies = currentEnemies.withEffectToMonster(targetId, effect)
      }

      logs.push(
        WizBattleLog.effectApplied(
          targetId,
          WizBattleLog.abilityEffect(ability.id, effectId)
        )
      )
    }

    return WizEngineBattleExecutionResult.accept({
      party: currentParty,
      enemies: currentEnemies,
      logs,
      success: true,
    })
  }

  private findActor(
    id: string,
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>
  ):
    | WizBattleCharacter<TStatus>
    | WizBattleMonster<TStatus, TCustom>
    | undefined {
    const partyMember = party.getMemberById(id)
    if (partyMember) return partyMember

    return enemies.getMonsterById(id)
  }

  private isPartyMember(id: string, party: WizBattleParty<TStatus>): boolean {
    return party.getMemberById(id) !== undefined
  }
}
