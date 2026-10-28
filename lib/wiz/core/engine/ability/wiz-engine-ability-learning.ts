import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

type AbilityTableEntry = {
  readonly abilityId: string
  readonly requiredLevel: number
}

export class WizEngineAbilityLearning {
  private readonly abilityTable: readonly AbilityTableEntry[]

  constructor(abilityTable: readonly AbilityTableEntry[]) {
    this.abilityTable = immutableConfig(abilityTable)
    Object.freeze(this)
  }

  getNewAbilities(level: number, ownedAbilityIds: readonly string[]): readonly string[] {
    const newAbilities: string[] = []
    for (const entry of this.abilityTable) {
      if (entry.requiredLevel > level) continue
      if (ownedAbilityIds.includes(entry.abilityId)) continue
      newAbilities.push(entry.abilityId)
    }
    return Object.freeze(newAbilities)
  }

  applyNewAbilities(vault: WizVaultValue, abilityIds: readonly string[]): WizVaultValue {
    let newVault = vault
    for (const abilityId of abilityIds) {
      newVault = newVault.updatePlayer((p) => p.addAbilityId(abilityId))
    }
    return newVault
  }
}
