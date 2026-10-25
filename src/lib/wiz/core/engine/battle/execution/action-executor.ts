import type { WizBattleCharacter } from "@/lib/wiz/core/engine/battle/actors/character"
import type { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import type { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import type { WizEffectConfig } from "@/lib/wiz/core/config/battle/wiz-effect-config"
import {
  WizEngineBattleContent,
  type WizEngineBattleContentResolver,
} from "@/lib/wiz/core/engine/battle/content"
import {
  createBattleEffect,
  deriveEffectiveBattleState,
} from "@/lib/wiz/core/engine/battle/effects"
import { WizIdGenerator, type WizIdSource } from "@/lib/wiz/core/services/wiz-id-generator"
import { WizEngineBattleExecutionResult } from "@/lib/wiz/core/engine/battle/execution/execution-result"
import { WizEngineBattleItemExecutor } from "@/lib/wiz/core/engine/battle/execution/item-executor"
import { WizEngineBattleAbilityExecutor } from "@/lib/wiz/core/engine/battle/execution/ability-executor"
import { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import type {
  WizEngineBattleDamageCalculator,
  WizEngineBattleDamageContext,
} from "@/lib/wiz/core/engine/damage/default-damage-calculator"
import { WizEngineBattleDefaultDamageCalculator } from "@/lib/wiz/core/engine/damage/default-damage-calculator"
import type { WizEngineBattleFleeCalculator } from "@/lib/wiz/core/engine/flee/default-flee-calculator"
import { WizEngineBattleDefaultFleeCalculator } from "@/lib/wiz/core/engine/flee/default-flee-calculator"
import { WizBattleLog, type WizLogMessage } from "@/lib/wiz/core/types/wiz-log-message"
import { assertFiniteNumberValue } from "@/lib/wiz/core/value-validation"
import {
  type WizEngineBattleResolvedAction,
  resolveCanonicalBattleAction,
  toCanonicalBattleTurnAction,
  validateBattleAction,
} from "@/lib/wiz/core/engine/battle/execution/action-validation"

export type WizEngineBattleExecutionOptions = {
  readonly weatherBonus?: number
  readonly abilityPowerMultiplier?: number
  readonly actorAbilityIds?: readonly string[]
  readonly availableItemIds?: readonly string[]
  readonly content?: WizEngineBattleContentResolver
}

export type WizEngineBattleTurnActionExecutorDefinition<TStatus = unknown> = {
  readonly damageCalculator?: WizEngineBattleDamageCalculator<TStatus>
  readonly fleeCalculator?: WizEngineBattleFleeCalculator
  readonly idGenerator?: WizIdSource
  readonly effectConfig?: WizEffectConfig
}

const captureDamageCalculator = <TStatus>(
  calculator: WizEngineBattleDamageCalculator<TStatus>,
): WizEngineBattleDamageCalculator<TStatus> => {
  if (
    typeof calculator !== "object" ||
    calculator === null ||
    typeof calculator.calculate !== "function"
  ) {
    throw new TypeError("Battle damage calculator must provide a calculate function")
  }
  return Object.freeze({
    calculate: Object.freeze(calculator.calculate.bind(calculator)),
  })
}

const captureFleeCalculator = (
  calculator: WizEngineBattleFleeCalculator,
): WizEngineBattleFleeCalculator => {
  if (
    typeof calculator !== "object" ||
    calculator === null ||
    typeof calculator.calculate !== "function"
  ) {
    throw new TypeError("Battle flee calculator must provide a calculate function")
  }
  return Object.freeze({
    calculate: Object.freeze(calculator.calculate.bind(calculator)),
  })
}

const captureIdSource = (source: WizIdSource): WizIdSource => {
  if (typeof source !== "object" || source === null || typeof source.next !== "function") {
    throw new TypeError("Battle ID source must provide a next function")
  }
  return Object.freeze({
    next: Object.freeze(source.next.bind(source)),
  })
}

const EMPTY_BATTLE_CONTENT = new WizEngineBattleContent()

export class WizEngineBattleTurnActionExecutor<TStatus = unknown, TCustom = unknown> {
  readonly damageCalculator: WizEngineBattleDamageCalculator<TStatus>
  readonly fleeCalculator: WizEngineBattleFleeCalculator
  readonly abilityExecutor: WizEngineBattleAbilityExecutor<TStatus, TCustom>
  readonly itemExecutor: WizEngineBattleItemExecutor<TStatus, TCustom>
  private readonly idGenerator: WizIdSource

  constructor(properties: WizEngineBattleTurnActionExecutorDefinition<TStatus> = {}) {
    this.damageCalculator = captureDamageCalculator(
      properties.damageCalculator ?? new WizEngineBattleDefaultDamageCalculator(),
    )
    this.fleeCalculator = captureFleeCalculator(
      properties.fleeCalculator ?? new WizEngineBattleDefaultFleeCalculator(),
    )
    this.idGenerator = captureIdSource(properties.idGenerator ?? new WizIdGenerator())
    this.abilityExecutor = new WizEngineBattleAbilityExecutor({
      damageCalculator: this.damageCalculator,
      idGenerator: this.idGenerator,
      effectConfig: properties.effectConfig,
    })
    this.itemExecutor = new WizEngineBattleItemExecutor({
      idGenerator: this.idGenerator,
    })
    Object.freeze(this)
  }

  readonly execute = (
    action: WizEngineBattleTurnAction,
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
    options: WizEngineBattleExecutionOptions = {},
  ): WizEngineBattleExecutionResult<TStatus, TCustom> => {
    WizEngineBattleTurnAction.assertAuthentic(action)
    const weatherBonus = options.weatherBonus ?? 0

    const abilityPowerMultiplier = options.abilityPowerMultiplier ?? 1.0
    assertFiniteNumberValue(
      "battle-action-executor",
      "options.abilityPowerMultiplier",
      abilityPowerMultiplier,
      { minimum: 0 },
    )
    const resolvedAction = resolveCanonicalBattleAction(
      action,
      options.content ?? EMPTY_BATTLE_CONTENT,
    )
    if (!resolvedAction) {
      return WizEngineBattleExecutionResult.reject({
        party,
        enemies,
        reason: "BATTLE_ACTION_REJECTED",
      })
    }
    const accepted = validateBattleAction({
      action: resolvedAction,
      party,
      enemies,
      authority: {
        actorAbilityIds: options.actorAbilityIds ?? [],
        availableItemIds: options.availableItemIds ?? [],
      },
    })
    if (!accepted) {
      return WizEngineBattleExecutionResult.reject({
        party,
        enemies,
        reason: "BATTLE_ACTION_REJECTED",
      })
    }
    const canonicalAction = toCanonicalBattleTurnAction(resolvedAction)

    if (resolvedAction.type === "attack") {
      return this.executeAttack(resolvedAction, party, enemies, weatherBonus).withAction(
        canonicalAction,
      )
    }

    if (resolvedAction.type === "ability") {
      return this.executeAbility(
        resolvedAction,
        party,
        enemies,
        weatherBonus,
        abilityPowerMultiplier,
      ).withAction(canonicalAction)
    }

    if (resolvedAction.type === "defend") {
      return this.executeDefend(resolvedAction, party, enemies).withAction(canonicalAction)
    }

    if (resolvedAction.type === "item") {
      return this.executeItem(resolvedAction, party, enemies).withAction(canonicalAction)
    }

    if (resolvedAction.type === "flee") {
      return this.executeFlee(resolvedAction, party, enemies).withAction(canonicalAction)
    }

    return WizEngineBattleExecutionResult.reject({
      party,
      enemies,
      reason: "BATTLE_ACTION_REJECTED",
    })
  }

  private executeAttack(
    action: Extract<WizEngineBattleResolvedAction, { type: "attack" }>,
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
    weatherBonus: number,
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    const logs: WizLogMessage[] = []
    let currentParty = party
    let currentEnemies = enemies

    const actor = this.findActor(action.actorId, party, enemies)
    if (!actor) {
      return WizEngineBattleExecutionResult.reject({
        party,
        enemies,
        reason: "BATTLE_ACTION_REJECTED",
      })
    }

    for (const targetId of action.targetIds) {
      const target = this.findActor(targetId, currentParty, currentEnemies)
      if (!target) continue

      logs.push(WizBattleLog.attack(action.actorId, targetId))

      const context: WizEngineBattleDamageContext = {
        abilityId: null,
        element: "physical",
        defenderAffinity: {},
        isBackAttack: false,
        isCriticalGuaranteed: false,
        isDefending: target.isDefending(),
        weatherBonus,
      }

      const damageResult = this.damageCalculator.calculate({
        attacker: deriveEffectiveBattleState(actor.status, actor.effects),
        defender: deriveEffectiveBattleState(target.status, target.effects),
        context,
      })

      if (damageResult.isEvaded) {
        logs.push(WizBattleLog.miss(action.actorId, targetId))
        continue
      }

      if (damageResult.isCritical) {
        logs.push(WizBattleLog.critical(action.actorId, targetId, damageResult.damage))
      }

      logs.push(WizBattleLog.damage(targetId, damageResult.damage))

      const isTargetPartyMember = this.isPartyMember(targetId, currentParty)
      if (isTargetPartyMember) {
        currentParty = currentParty.withDamageToMember(targetId, damageResult.damage)
        const updatedTarget = currentParty.getMemberById(targetId)
        if (updatedTarget?.isDead()) {
          logs.push(WizBattleLog.death(targetId))
        }
      } else {
        currentEnemies = currentEnemies.withDamageToMonster(targetId, damageResult.damage)
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

  private executeAbility(
    action: Extract<WizEngineBattleResolvedAction, { type: "ability" }>,
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
    weatherBonus: number,
    abilityPowerMultiplier: number,
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    return this.abilityExecutor.execute(
      action.ability,
      action.actorId,
      action.targetIds,
      party,
      enemies,
      {
        weatherBonus,
        abilityPowerMultiplier,
      },
    )
  }

  private executeDefend(
    action: Extract<WizEngineBattleResolvedAction, { type: "defend" }>,
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    const logs: WizLogMessage[] = []
    let currentParty = party
    let currentEnemies = enemies

    const actor = this.findActor(action.actorId, party, enemies)
    if (!actor) {
      return WizEngineBattleExecutionResult.reject({
        party,
        enemies,
        reason: "BATTLE_ACTION_REJECTED",
      })
    }

    const defendEffect = createBattleEffect({
      instanceId: `defend-${action.actorId}-${this.idGenerator.next()}`,
      effectId: "defending",
      source: { kind: "system", id: action.id },
      name: "Defending",
      lifetime: { type: "turns", remaining: 1 },
    })

    logs.push(WizBattleLog.defend(action.actorId))

    const isActorPartyMember = this.isPartyMember(action.actorId, party)
    if (isActorPartyMember) {
      currentParty = currentParty.withEffectToMember(action.actorId, defendEffect)
    } else {
      currentEnemies = currentEnemies.withEffectToMonster(action.actorId, defendEffect)
    }

    logs.push(WizBattleLog.effectApplied(action.actorId, WizBattleLog.effect("defending")))

    return WizEngineBattleExecutionResult.accept({
      party: currentParty,
      enemies: currentEnemies,
      logs,
      success: true,
    })
  }

  private executeItem(
    action: Extract<WizEngineBattleResolvedAction, { type: "item" }>,
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    return this.itemExecutor.execute(action.item, action.actorId, action.targetIds, party, enemies)
  }

  private executeFlee(
    action: Extract<WizEngineBattleResolvedAction, { type: "flee" }>,
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
  ): WizEngineBattleExecutionResult<TStatus, TCustom> {
    const logs: WizLogMessage[] = []
    let currentParty = party

    const actor = this.findActor(action.actorId, party, enemies)
    if (!actor) {
      return WizEngineBattleExecutionResult.reject({
        party,
        enemies,
        reason: "BATTLE_ACTION_REJECTED",
      })
    }

    logs.push(WizBattleLog.flee(action.actorId))

    const actorSpeed = deriveEffectiveBattleState(actor.status, actor.effects).attributes.value(
      "speed",
    )

    const enemyMonsters = enemies.getAllAliveMonsters()
    const enemyAverageSpeed =
      enemyMonsters.length > 0
        ? enemyMonsters.reduce(
            (sum, monster) =>
              sum +
              deriveEffectiveBattleState(monster.status, monster.effects).attributes.value("speed"),
            0,
          ) / enemyMonsters.length
        : 1

    const fleeResult = this.fleeCalculator.calculate({
      partyAverageSpeed: actorSpeed,
      enemyAverageSpeed,
      attemptCount: 1,
    })

    if (fleeResult.success) {
      logs.push(WizBattleLog.fleeSuccess(action.actorId))

      const fledEffect = createBattleEffect({
        instanceId: `fled-${action.actorId}-${this.idGenerator.next()}`,
        effectId: "fled",
        source: { kind: "system", id: action.id },
        name: "Fled",
        lifetime: { type: "permanent" },
      })

      const isActorPartyMember = this.isPartyMember(action.actorId, party)
      if (isActorPartyMember) {
        currentParty = currentParty.withEffectToMember(action.actorId, fledEffect)
      }
    } else {
      logs.push(WizBattleLog.fleeFailed(action.actorId))
    }

    return WizEngineBattleExecutionResult.accept({
      party: currentParty,
      enemies,
      logs,
      success: fleeResult.success,
    })
  }

  private findActor(
    id: string,
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>,
  ): WizBattleCharacter<TStatus> | WizBattleMonster<TStatus, TCustom> | undefined {
    const partyMember = party.getMemberById(id)
    if (partyMember) return partyMember

    return enemies.getMonsterById(id)
  }

  private isPartyMember(id: string, party: WizBattleParty<TStatus>): boolean {
    return party.getMemberById(id) !== undefined
  }
}

Object.freeze(WizEngineBattleTurnActionExecutor.prototype)
Object.freeze(WizEngineBattleTurnActionExecutor)
