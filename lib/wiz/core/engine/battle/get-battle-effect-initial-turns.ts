import type { WizEffectConfig } from "@/lib/wiz/core/config/battle/wiz-effect-config"

export const getBattleEffectInitialTurns = (
  effectId: string,
  config: WizEffectConfig
): number => {
  if (
    effectId === "attackUp" ||
    effectId === "defenseUp" ||
    effectId === "speedUp"
  ) {
    return config.defaultBuffTurns
  }
  if (
    effectId === "attackDown" ||
    effectId === "defenseDown" ||
    effectId === "speedDown"
  ) {
    return config.defaultDebuffTurns
  }
  return config.defaultEffectTurns
}
