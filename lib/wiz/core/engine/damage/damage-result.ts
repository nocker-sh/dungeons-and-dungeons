import { assertBooleanValue } from "@/lib/wiz/core/assert-boolean-value"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import { assertRecordValue } from "@/lib/wiz/core/assert-record-value"

export type WizEngineBattleDamageResultDefinition = {
  readonly damage: number
  readonly isCritical: boolean
  readonly isEvaded: boolean
  readonly isBlocked: boolean
  readonly elementalModifier: number
  readonly hitCount: number
}

export class WizEngineBattleDamageResult {
  readonly damage: number
  readonly isCritical: boolean
  readonly isEvaded: boolean
  readonly isBlocked: boolean
  readonly elementalModifier: number
  readonly hitCount: number

  constructor(properties: WizEngineBattleDamageResultDefinition) {
    assertRecordValue("damage-result", "$", properties)
    assertFiniteNumberValue("damage-result", "damage", properties.damage, {
      minimum: 0,
    })
    assertBooleanValue("damage-result", "isCritical", properties.isCritical)
    assertBooleanValue("damage-result", "isEvaded", properties.isEvaded)
    assertBooleanValue("damage-result", "isBlocked", properties.isBlocked)
    assertFiniteNumberValue(
      "damage-result",
      "elementalModifier",
      properties.elementalModifier,
      {
        minimum: 0,
      }
    )
    assertFiniteNumberValue("damage-result", "hitCount", properties.hitCount, {
      minimum: 0,
      safeInteger: true,
    })
    assertFiniteNumberValue(
      "damage-result",
      "totalDamage",
      properties.damage * properties.hitCount,
      { minimum: 0 }
    )

    this.damage = properties.damage
    this.isCritical = properties.isCritical
    this.isEvaded = properties.isEvaded
    this.isBlocked = properties.isBlocked
    this.elementalModifier = properties.elementalModifier
    this.hitCount = properties.hitCount
    Object.freeze(this)
  }

  getTotalDamage(): number {
    if (this.isEvaded) {
      return 0
    }
    return this.damage * this.hitCount
  }

  isHit(): boolean {
    return !this.isEvaded
  }

  toProperties(): WizEngineBattleDamageResultDefinition {
    return {
      damage: this.damage,
      isCritical: this.isCritical,
      isEvaded: this.isEvaded,
      isBlocked: this.isBlocked,
      elementalModifier: this.elementalModifier,
      hitCount: this.hitCount,
    }
  }
}

Object.freeze(WizEngineBattleDamageResult.prototype)
Object.freeze(WizEngineBattleDamageResult)
