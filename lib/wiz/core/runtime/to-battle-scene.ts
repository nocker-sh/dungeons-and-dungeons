import { WizStateBattle } from "@/lib/wiz/core/runtime/scenes/battle/state"
import type { WizStateBattlePhase } from "@/lib/wiz/core/runtime/scenes/battle/state"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export function toBattleScene<
  TStatus = unknown,
  TCustom = unknown,
  TRewardCustom = undefined,
>(
  vault: WizVaultValue,
  wizScene: WizStateBattlePhase<TStatus, TCustom, TRewardCustom>,
  returnAreaId: string
): WizStateBattle<TStatus, TCustom, TRewardCustom> {
  return new WizStateBattle<TStatus, TCustom, TRewardCustom>({
    type: "battle",
    phase: wizScene,
    returnAreaId,
    vault,
  })
}
