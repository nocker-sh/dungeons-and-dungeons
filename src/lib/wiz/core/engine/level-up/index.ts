import {
  DEFAULT_LEVEL_UP_CONFIG,
  type WizLevelUpConfig,
} from "@/lib/wiz/core/config/level-up/wiz-level-up-config"
import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import type { WizPendingAttributes } from "@/lib/wiz/core/domain/values/pending-attributes"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export class WizEngineLevelUp {
  private readonly config: WizLevelUpConfig

  constructor(config: WizLevelUpConfig = DEFAULT_LEVEL_UP_CONFIG) {
    this.config = immutableConfig(config)
    Object.freeze(this)
  }

  getExpToNextLevel(level: number): number {
    return this.config.expFormula(level)
  }

  getPointsPerLevelUp(): number {
    return this.config.pointsPerLevelUp
  }

  getHpGain(vitalityBonus: number): number {
    return this.config.hpGainFormula(vitalityBonus)
  }

  applyLevelUp(vault: WizVaultValue, pendingAttributes: WizPendingAttributes): WizVaultValue {
    this.assertLevelUpAvailable(vault)
    const player = vault.player
    const newLevel = player.level + 1
    const newMaxHp = player.maxHp + this.getHpGain(pendingAttributes.vitalityBonus)
    const newExpToNextLevel = this.getExpToNextLevel(newLevel)
    const remainingExp = Math.max(0, player.exp - player.expToNextLevel)

    let newPlayer = player.levelUp(newMaxHp, newExpToNextLevel).withExp(remainingExp)

    for (const [attribute, amount] of pendingAttributes.entries()) {
      newPlayer = newPlayer.addAttribute(attribute, amount)
    }

    return vault.withPlayer(newPlayer)
  }

  shouldLevelUp(vault: WizVaultValue): boolean {
    return vault.player.exp >= vault.player.expToNextLevel
  }

  prepareLevelUp(vault: WizVaultValue): {
    vault: WizVaultValue
    pointsToAllocate: number
  } {
    this.assertLevelUpAvailable(vault)
    const pointsToAllocate = this.getPointsPerLevelUp()
    const newVault = vault.addLog({
      key: "LEVEL_UP_POINTS_GRANTED",
      points: pointsToAllocate,
    })
    return { vault: newVault, pointsToAllocate }
  }

  private assertLevelUpAvailable(vault: WizVaultValue): void {
    if (!this.shouldLevelUp(vault)) {
      throw new RangeError("Level up is not available for the current vault")
    }
  }
}
