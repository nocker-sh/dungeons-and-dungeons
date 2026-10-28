import type { WizBattleEffectReference } from "@/lib/wiz/core/types/wiz-log-message"

export const WIZ_BATTLE_EFFECT_NAMES_JA: Readonly<Record<string, string>> =
  Object.freeze({
    poison: "毒",
    paralysis: "麻痺",
    sleep: "睡眠",
    silence: "沈黙",
    confusion: "混乱",
    blind: "暗闇",
    dead: "戦闘不能",
    fled: "逃走",
    defending: "防御",
    attackUp: "攻撃力上昇",
    attackDown: "攻撃力低下",
    defenseUp: "防御力上昇",
    defenseDown: "防御力低下",
    speedUp: "速度上昇",
    speedDown: "速度低下",
  })

export function formatWizBattleEffectNameJa(
  effect: WizBattleEffectReference,
  fallbackName: string
): string {
  if (effect.source !== "system") {
    return fallbackName
  }
  return WIZ_BATTLE_EFFECT_NAMES_JA[effect.effectType] ?? fallbackName
}
