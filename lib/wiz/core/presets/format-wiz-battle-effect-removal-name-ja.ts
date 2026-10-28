import type { WizBattleEffectRemoval } from "@/lib/wiz/core/types/wiz-log-message"
import { formatWizBattleEffectNameJa } from "@/lib/wiz/core/presets/format-wiz-battle-effect-name-ja"

export function formatWizBattleEffectRemovalNameJa(
  removal: WizBattleEffectRemoval,
  fallbackName: string
): string {
  if (removal.scope === "all") {
    return "全ての状態効果"
  }
  return formatWizBattleEffectNameJa(removal.effect, fallbackName)
}
