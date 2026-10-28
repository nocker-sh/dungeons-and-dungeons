import {
  DEFAULT_FLEE_CONFIG,
  type WizFleeConfig,
} from "@/lib/wiz/core/config/battle/wiz-flee-config"
import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"
import { WizEngineBattleFleeResult } from "@/lib/wiz/core/engine/flee/flee-result"

export type WizEngineBattleFleeParameters = {
  readonly partyAverageSpeed: number
  readonly enemyAverageSpeed: number
  readonly attemptCount: number
}

/**
 * 逃走判定を差し替えるstructural port。
 *
 * 既定実装は {@link WizEngineBattleDefaultFleeCalculator} で、
 * `WizFleeConfig` のパラメータをチューニングできる。
 * 完全に独自ロジックにする場合は本portを実装して
 * `WizEngineBattleTurnActionExecutor.fleeCalculator` に渡す。
 */
export type WizEngineBattleFleeCalculator = {
  readonly calculate: (parameters: WizEngineBattleFleeParameters) => WizEngineBattleFleeResult
}

export type WizEngineBattleDefaultFleeCalculatorDefinition = {
  readonly config?: WizFleeConfig
  readonly dice?: WizDice
}

export class WizEngineBattleDefaultFleeCalculator implements WizEngineBattleFleeCalculator {
  private readonly config: WizFleeConfig
  private readonly dice: WizDice

  constructor(properties: WizEngineBattleDefaultFleeCalculatorDefinition = {}) {
    this.config = immutableConfig(properties.config ?? DEFAULT_FLEE_CONFIG)
    this.dice = properties.dice ?? new WizDice()
    Object.freeze(this)
  }

  readonly calculate = (parameters: WizEngineBattleFleeParameters): WizEngineBattleFleeResult => {
    const speedRatio = parameters.partyAverageSpeed / parameters.enemyAverageSpeed
    const speedBonus = Math.min(
      speedRatio * this.config.speedBonusMultiplier,
      this.config.maxSpeedBonus,
    )
    const attemptBonus = parameters.attemptCount * this.config.attemptBonusPerTry
    const totalChance = Math.min(
      this.config.baseChance + speedBonus + attemptBonus,
      this.config.maxChance,
    )

    const success = this.dice.chance(totalChance * 100)

    return new WizEngineBattleFleeResult({
      success,
      canRetry: !success,
    })
  }
}

Object.freeze(WizEngineBattleDefaultFleeCalculator.prototype)
Object.freeze(WizEngineBattleDefaultFleeCalculator)
