import type { WizAction } from "@/lib/wiz/core/runtime/action"
import type { WizEngineShopDialogueService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-dialogue-service"
import { WizSceneResultFactory, type WizSceneResult } from "@/lib/wiz/core/runtime/scene-result"
import type { WizSceneVillageAction } from "@/lib/wiz/core/runtime/scenes/village/action"
import type { WizStateVillage } from "@/lib/wiz/core/runtime/scenes/village/state"
import type { WizState } from "@/lib/wiz/core/runtime/state"

const VILLAGE_ACTIONS = new Set(["explore", "shop", "quest", "talk", "home", "inn"])

type Dependencies = Readonly<{
  readonly shopDialogueService?: Pick<WizEngineShopDialogueService, "getDialogue">
}>

export class WizSceneVillageReducer {
  private readonly shopDialogueService?: Pick<WizEngineShopDialogueService, "getDialogue">

  constructor(dependencies: Dependencies = {}) {
    this.shopDialogueService = dependencies.shopDialogueService
    Object.freeze(this)
  }

  reduce(state: WizState, action: WizAction | WizSceneVillageAction): WizSceneResult<WizState> {
    if (state.type !== "village") return WizSceneResultFactory.accept(state)

    if (action.type === "SELECT_VILLAGE_ACTION") {
      if (!VILLAGE_ACTIONS.has(action.action) || state.selectedAction === action.action) {
        return WizSceneResultFactory.reject(state, "VILLAGE_ACTION_REJECTED")
      }
      return WizSceneResultFactory.accept(state.withSelectedAction(action.action))
    }

    if (action.type === "GO_TO_SHOP") {
      return this.handleGoToShop(state, action)
    }

    if (action.type === "GO_TO_INN") {
      const newVault = state.vault.addLog({ key: "ENTERED_INN" })
      return WizSceneResultFactory.accept(state.withVault(newVault), { type: "GO_TO_INN" })
    }

    if (action.type === "GO_TO_EXPLORATION") {
      return this.handleGoToExploration(state, action)
    }

    if (action.type === "TALK_TO_NPC") {
      return this.handleTalkToNpc(state, action)
    }

    if (action.type === "GO_TO_QUEST") {
      return WizSceneResultFactory.accept(state, { type: "GO_TO_QUEST" })
    }

    if (action.type === "GO_TO_CRAFTING") {
      return WizSceneResultFactory.accept(state, { type: "GO_TO_CRAFTING" })
    }

    return WizSceneResultFactory.accept(state)
  }

  private handleGoToShop(
    state: WizStateVillage,
    action: { readonly shopId: string },
  ): WizSceneResult<WizState> {
    const dialogue = this.shopDialogueService?.getDialogue(action.shopId)
    if (!dialogue || dialogue.shopId !== action.shopId) {
      return WizSceneResultFactory.reject(state, "SHOP_NOT_FOUND")
    }
    const newVault = state.vault.addLog({
      key: "ENTERED_SHOP",
      shopId: dialogue.shopId,
    })
    return WizSceneResultFactory.accept(state.withVault(newVault), {
      type: "GO_TO_SHOP",
      shopId: dialogue.shopId,
    })
  }

  private handleGoToExploration(
    state: WizStateVillage,
    action: { areaId: string },
  ): WizSceneResult<WizState> {
    const area = state.vault.areas.find((a) => a.id === action.areaId)
    if (!area || !area.unlocked) {
      return WizSceneResultFactory.reject(state, "VILLAGE_ACTION_REJECTED")
    }
    if (state.vault.player.ap < area.apCost) {
      return WizSceneResultFactory.reject(
        state.updateVault((v) => v.addLog({ key: "NOT_ENOUGH_AP" })),
        "VILLAGE_ACTION_REJECTED",
      )
    }
    const newVault = state.vault
      .withLog([])
      .updatePlayer((p) => p.useAp(area.apCost))
      .addLog({ key: "ENTERED_AREA", areaId: action.areaId })
    return WizSceneResultFactory.accept(state.withVault(newVault), {
      type: "GO_TO_EXPLORATION",
      areaId: action.areaId,
    })
  }

  private handleTalkToNpc(
    state: WizStateVillage,
    action: { npcId: string },
  ): WizSceneResult<WizState> {
    const npc = state.vault.npcs.find((n) => n.id === action.npcId)
    if (!npc) {
      return WizSceneResultFactory.reject(state, "VILLAGE_ACTION_REJECTED")
    }
    const newVault = state.vault.addLog({
      key: "TALKED_TO_NPC",
      npcId: action.npcId,
    })
    return WizSceneResultFactory.accept(state.withVault(newVault), {
      type: "GO_TO_CONVERSATION",
      npcId: action.npcId,
    })
  }
}
