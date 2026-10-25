import type { WizRequirementContext, WizRequirements } from "@/lib/wiz/core/types"
import { WizVaultFlagService } from "@/lib/wiz/core/vault/services/flag-service"

export class WizVaultRequirementService {
  private readonly flagService: WizVaultFlagService

  constructor(flagService?: WizVaultFlagService) {
    this.flagService = flagService ?? new WizVaultFlagService()
    Object.freeze(this)
  }

  meetsRequirements(requirements: WizRequirements, context: WizRequirementContext): boolean {
    if (requirements.minLevel !== undefined) {
      if (
        !Number.isFinite(requirements.minLevel) ||
        !Number.isInteger(requirements.minLevel) ||
        requirements.minLevel < 0
      ) {
        return false
      }
      if ((context.level ?? 0) < requirements.minLevel) return false
    }
    if (requirements.maxLevel !== undefined) {
      if (
        !Number.isFinite(requirements.maxLevel) ||
        !Number.isInteger(requirements.maxLevel) ||
        requirements.maxLevel < 0
      ) {
        return false
      }
      if ((context.level ?? 0) > requirements.maxLevel) return false
    }
    if (requirements.requiredFlags !== undefined) {
      if (!this.flagService.hasAllFlags(context.flags ?? [], requirements.requiredFlags))
        return false
    }
    if (requirements.forbiddenFlags !== undefined) {
      for (const flag of requirements.forbiddenFlags) {
        if (this.flagService.hasFlag(context.flags ?? [], flag)) return false
      }
    }
    if (requirements.requiredItems !== undefined) {
      for (const req of requirements.requiredItems) {
        if (
          !Number.isFinite(req.quantity) ||
          !Number.isInteger(req.quantity) ||
          req.quantity <= 0
        ) {
          return false
        }
        if ((context.inventory?.totalQuantity("item", req.itemId) ?? 0) < req.quantity) {
          return false
        }
      }
    }
    if (requirements.minAffinity !== undefined) {
      if (!Number.isFinite(requirements.minAffinity)) return false
      if ((context.affinity ?? 0) < requirements.minAffinity) return false
    }
    if (requirements.maxAffinity !== undefined) {
      if (!Number.isFinite(requirements.maxAffinity)) return false
      if ((context.affinity ?? 0) > requirements.maxAffinity) return false
    }
    return true
  }
}
