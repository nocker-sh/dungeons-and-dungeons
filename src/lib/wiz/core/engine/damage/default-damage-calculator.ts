import {
  createDefaultDamageConfig,
  type WizDamageConfig,
} from "@/lib/wiz/core/config/battle/wiz-damage-config"
import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import type { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"
import type { WizEngineBattleElementalAffinity } from "@/lib/wiz/core/engine/battle/types"
import { WizEngineBattleDamageResult } from "@/lib/wiz/core/engine/damage/damage-result"
import type { WizBattleStatusView } from "@/lib/wiz/core/types/wiz-types"
import { assertFiniteNumberValue } from "@/lib/wiz/core/value-validation"

export type WizEngineBattleDamageContext = {
  readonly abilityId: string | null
  readonly element: string
  readonly defenderAffinity: WizEngineBattleElementalAffinity
  readonly isBackAttack: boolean
  readonly isCriticalGuaranteed: boolean
  readonly isDefending: boolean
  readonly weatherBonus: number
  readonly abilityPowerMultiplier?: number
}

export type WizEngineBattleDamageParameters<TStatus = unknown> = {
  readonly attacker: WizBattleActorState<TStatus>
  readonly defender: WizBattleActorState<TStatus>
  readonly context: WizEngineBattleDamageContext
}

/**
 * ダメージ計算を差し替えるstructural port。
 *
 * 既定実装は {@link WizEngineBattleDefaultDamageCalculator}。
 * カスタム計算式を入れたい場合:
 * 1. `WizDamageConfig` で式を差し替えられるなら `WizPresetValue.create` の `damage` で十分
 * 2. それ以上 (専用乱数や状態遷移が必要) なら本portを実装し、
 *    `WizEngineBattleTurnActionExecutor.damageCalculator` に渡す
 */
export type WizEngineBattleDamageCalculator<TStatus = unknown> = {
  readonly calculate: (
    parameters: WizEngineBattleDamageParameters<TStatus>,
  ) => WizEngineBattleDamageResult
}

export type WizEngineBattleDefaultDamageCalculatorDefinition<
  TStatusCustom = Record<string, never>,
> = {
  readonly config?: WizDamageConfig<WizBattleStatusView<TStatusCustom>>
  readonly dice?: WizDice
}

export class WizEngineBattleDefaultDamageCalculator<
  TStatusCustom = Record<string, never>,
> implements WizEngineBattleDamageCalculator<TStatusCustom> {
  private readonly config: WizDamageConfig<WizBattleStatusView<TStatusCustom>>
  private readonly dice: WizDice

  constructor(properties: WizEngineBattleDefaultDamageCalculatorDefinition<TStatusCustom> = {}) {
    this.config = immutableConfig(
      properties.config ?? createDefaultDamageConfig<WizBattleStatusView<TStatusCustom>>(),
    )
    this.dice = properties.dice ?? new WizDice()
    Object.freeze(this)
  }

  readonly calculate = (
    parameters: WizEngineBattleDamageParameters<TStatusCustom>,
  ): WizEngineBattleDamageResult => {
    const attacker = parameters.attacker.toFormulaView()
    const defender = parameters.defender.toFormulaView()
    const evasionChance = this.config.evasionFormula(defender)
    assertFiniteNumberValue("damage-calculator", "evasionFormula", evasionChance, {
      maximum: 1,
      minimum: 0,
    })
    const isEvaded = this.dice.chance(evasionChance * 100)

    if (isEvaded) {
      return new WizEngineBattleDamageResult({
        damage: 0,
        isCritical: false,
        isEvaded: true,
        isBlocked: false,
        elementalModifier: 1.0,
        hitCount: 0,
      })
    }

    const formulaDamage = this.config.damageFormula(attacker, defender)
    assertFiniteNumberValue("damage-calculator", "damageFormula", formulaDamage, {
      minimum: 0,
    })
    assertFiniteNumberValue(
      "damage-calculator",
      "config.minimumDamage",
      this.config.minimumDamage,
      { minimum: 0 },
    )
    const baseDamage = Math.max(this.config.minimumDamage, formulaDamage)

    const criticalChance = parameters.context.isCriticalGuaranteed
      ? 1.0
      : this.config.criticalChance
    assertFiniteNumberValue("damage-calculator", "config.criticalChance", criticalChance, {
      maximum: 1,
      minimum: 0,
    })
    const isCritical = this.dice.chance(criticalChance * 100)
    const criticalMultiplier = isCritical ? this.config.criticalMultiplier : 1.0
    assertFiniteNumberValue("damage-calculator", "config.criticalMultiplier", criticalMultiplier, {
      minimum: 0,
    })

    const backAttackMultiplier = parameters.context.isBackAttack
      ? this.config.backAttackMultiplier
      : 1.0
    assertFiniteNumberValue(
      "damage-calculator",
      "config.backAttackMultiplier",
      backAttackMultiplier,
      { minimum: 0 },
    )
    const defendMultiplier = parameters.context.isDefending ? this.config.defendMultiplier : 1.0
    assertFiniteNumberValue("damage-calculator", "config.defendMultiplier", defendMultiplier, {
      minimum: 0,
    })

    const configuredElementalModifier =
      parameters.context.defenderAffinity[parameters.context.element]
    const elementalModifier =
      configuredElementalModifier === undefined ? 1.0 : configuredElementalModifier
    assertFiniteNumberValue(
      "damage-calculator",
      `context.defenderAffinity.${parameters.context.element}`,
      elementalModifier,
      { minimum: 0 },
    )

    assertFiniteNumberValue("damage-calculator", "config.varianceMin", this.config.varianceMin, {
      minimum: 0,
    })
    assertFiniteNumberValue("damage-calculator", "config.varianceMax", this.config.varianceMax, {
      minimum: this.config.varianceMin,
    })
    const varianceRange = this.config.varianceMax - this.config.varianceMin
    const varianceRoll = this.dice.roll(1, 1000).rolls[0] / 1000
    const variance = this.config.varianceMin + varianceRoll * varianceRange
    assertFiniteNumberValue(
      "damage-calculator",
      "context.weatherBonus",
      parameters.context.weatherBonus,
    )
    const weatherModifier = Math.max(0.5, 1.0 + parameters.context.weatherBonus * 0.1)
    const configuredAbilityPowerMultiplier =
      parameters.context.abilityPowerMultiplier === undefined
        ? 1.0
        : parameters.context.abilityPowerMultiplier
    assertFiniteNumberValue(
      "damage-calculator",
      "context.abilityPowerMultiplier",
      configuredAbilityPowerMultiplier,
      { minimum: 0 },
    )
    const abilityPowerMultiplier =
      parameters.context.abilityId === null ? 1 : configuredAbilityPowerMultiplier
    const finalDamage = Math.floor(
      baseDamage *
        criticalMultiplier *
        backAttackMultiplier *
        defendMultiplier *
        elementalModifier *
        variance *
        weatherModifier *
        abilityPowerMultiplier,
    )
    assertFiniteNumberValue("damage-calculator", "finalDamage", finalDamage, {
      minimum: 0,
    })

    return new WizEngineBattleDamageResult({
      damage: Math.max(this.config.minimumDamage, finalDamage),
      isCritical,
      isEvaded: false,
      isBlocked: false,
      elementalModifier,
      hitCount: 1,
    })
  }
}

Object.freeze(WizEngineBattleDefaultDamageCalculator.prototype)
Object.freeze(WizEngineBattleDefaultDamageCalculator)
