import type { WizBattleAttributeModifier } from "@/lib/wiz/core/engine/battle/effects"

export const defaultModifier = (
  effectId: string,
  power: number
): WizBattleAttributeModifier => {
  if (!Number.isFinite(power)) return Object.freeze({})
  if (effectId === "attackUp") return Object.freeze({ attack: power })
  if (effectId === "attackDown") return Object.freeze({ attack: -power })
  if (effectId === "defenseUp") return Object.freeze({ defense: power })
  if (effectId === "defenseDown") return Object.freeze({ defense: -power })
  if (effectId === "speedUp") return Object.freeze({ speed: power })
  if (effectId === "speedDown") return Object.freeze({ speed: -power })
  return Object.freeze({})
}
