import type { WizStateBattle } from "@/lib/wiz/core/runtime/scenes/battle/state"
import type { WizStateConversation } from "@/lib/wiz/core/runtime/scenes/conversation/state"
import type { WizStateCrafting } from "@/lib/wiz/core/runtime/scenes/crafting/state"
import type { WizStateExploration } from "@/lib/wiz/core/runtime/scenes/exploration/states/state"
import type { WizStateInn } from "@/lib/wiz/core/runtime/scenes/inn/state"
import type { WizStateLevelUp } from "@/lib/wiz/core/runtime/scenes/level-up/state"
import type { WizStateQuest } from "@/lib/wiz/core/runtime/scenes/quest/state"
import type { WizStateShop } from "@/lib/wiz/core/runtime/scenes/shop/state"
import type { WizStateVillage } from "@/lib/wiz/core/runtime/scenes/village/state"
import type {
  WizBattleMonsterCustom,
  WizBattleStatusCustom,
  WizTypes,
} from "@/lib/wiz/core/types/wiz-types"

export type WizState<TBattleStatus = unknown, TBattleCustom = unknown, TRewardCustom = undefined> =
  | WizStateVillage
  | WizStateShop
  | WizStateInn
  | WizStateExploration
  | WizStateBattle<TBattleStatus, TBattleCustom, TRewardCustom>
  | WizStateConversation
  | WizStateCrafting
  | WizStateQuest
  | WizStateLevelUp

/** `WizTypes` の戦闘拡張と報酬拡張を保持した standard runtime state。 */
export type WizStateFor<TTypes extends WizTypes, TRewardCustom = undefined> = WizState<
  WizBattleStatusCustom<TTypes["BattleStatus"]>,
  WizBattleMonsterCustom<TTypes>,
  TRewardCustom
>

export type WizSceneType = WizState["type"]
