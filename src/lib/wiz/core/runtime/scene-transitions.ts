import {
  WizStateBattle,
  type WizStateBattlePhase,
} from "@/lib/wiz/core/runtime/scenes/battle/state"
import { WizEngineConversationDialogueSelector } from "@/lib/wiz/core/engine/conversation/dialogue-selector"
import {
  openWizConversationDialogue,
  WizConversationProgress,
  WizStateConversation,
} from "@/lib/wiz/core/runtime/scenes/conversation/state"
import { WizStateCrafting } from "@/lib/wiz/core/runtime/scenes/crafting/state"
import { WizStateExploration } from "@/lib/wiz/core/runtime/scenes/exploration/states/state"
import { WizStateInn } from "@/lib/wiz/core/runtime/scenes/inn/state"
import { WizStateLevelUp } from "@/lib/wiz/core/runtime/scenes/level-up/state"
import { WizStateQuest } from "@/lib/wiz/core/runtime/scenes/quest/state"
import { WizStateShop } from "@/lib/wiz/core/runtime/scenes/shop/state"
import { WizStateVillage } from "@/lib/wiz/core/runtime/scenes/village/state"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export function toVillageScene(vault: WizVaultValue): WizStateVillage {
  return new WizStateVillage({
    type: "village",
    selectedAction: null,
    vault,
  })
}

export function toShopScene(
  vault: WizVaultValue,
  shopId: string,
  options?: { buyPriceModifier?: number },
): WizStateShop {
  return new WizStateShop({
    type: "shop",
    shopId,
    buyPriceModifier: options?.buyPriceModifier ?? 1.0,
    pendingPurchase: null,
    message: null,
    conversation: null,
    lastConversation: null,
    vault,
  })
}

export function toInnScene(vault: WizVaultValue): WizStateInn {
  return new WizStateInn({
    type: "inn",
    selectedPlan: null,
    confirmingStay: false,
    message: null,
    vault,
  })
}

export function toExplorationScene(vault: WizVaultValue, areaId: string): WizStateExploration {
  return new WizStateExploration({
    type: "exploration",
    areaId,
    eventProgress: { status: "none" },
    message: null,
    vault,
  })
}

export function toConversationScene(vault: WizVaultValue, npcId: string): WizStateConversation {
  const npc = vault.findNpc(npcId)
  const dialogue = npc
    ? new WizEngineConversationDialogueSelector().select({
        npc,
        vault,
      })
    : undefined
  const opening = dialogue ? openWizConversationDialogue(dialogue) : null

  return new WizStateConversation({
    type: "conversation",
    npcId,
    progress: opening?.progress ?? WizConversationProgress.idle(),
    transcript: opening?.transcript ?? [],
    pendingGiftItemId: null,
    vault,
  })
}

export function toQuestScene(vault: WizVaultValue): WizStateQuest {
  return new WizStateQuest({
    type: "quest",
    selectedQuest: null,
    message: null,
    vault,
  })
}

export function toCraftingScene(vault: WizVaultValue): WizStateCrafting {
  return new WizStateCrafting({
    type: "crafting",
    selectedRecipe: null,
    confirmingCraft: false,
    result: { status: "pending" },
    message: null,
    vault,
    availableFacilities: vault.unlockedFacilities,
  })
}

export function toLevelUpScene(
  vault: WizVaultValue,
  points: number,
  returnAreaId: string | null = null,
): WizStateLevelUp {
  return new WizStateLevelUp({
    type: "level_up",
    availablePoints: points,
    pendingAttributes: {},
    returnAreaId,
    vault,
  })
}

export function toBattleScene<TStatus = unknown, TCustom = unknown, TRewardCustom = undefined>(
  vault: WizVaultValue,
  wizScene: WizStateBattlePhase<TStatus, TCustom, TRewardCustom>,
  returnAreaId: string,
): WizStateBattle<TStatus, TCustom, TRewardCustom> {
  return new WizStateBattle<TStatus, TCustom, TRewardCustom>({
    type: "battle",
    phase: wizScene,
    returnAreaId,
    vault,
  })
}
