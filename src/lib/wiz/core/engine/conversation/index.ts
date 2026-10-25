import {
  DEFAULT_CONVERSATION_CONFIG,
  type WizConversationConfig,
} from "@/lib/wiz/core/config/conversation/wiz-conversation-config"
import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import type { WizStateGift } from "@/lib/wiz/core/domain/values/gift"
import {
  WizConversationAffinitySystem,
  type WizConversationAffinityPort,
} from "@/lib/wiz/core/engine/conversation/affinity-system"
import type {
  WizConversationEvent,
  WizConversationRejection,
  WizConversationResult,
} from "@/lib/wiz/core/engine/conversation/types"
import type { WizStandardInventoryService } from "@/lib/wiz/core/rpg/standard-inventory"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export type WizEngineConversationProperties = {
  readonly config?: Partial<WizConversationConfig>
  readonly affinitySystem?: WizConversationAffinityPort
  readonly inventoryService: WizStandardInventoryService
}

export class WizEngineConversation {
  private readonly _affinitySystem: WizConversationAffinityPort
  private readonly _config: WizConversationConfig
  private readonly inventoryService: WizStandardInventoryService

  constructor(properties: WizEngineConversationProperties) {
    this._config = immutableConfig({
      ...DEFAULT_CONVERSATION_CONFIG,
      ...properties.config,
    })
    this._affinitySystem =
      properties.affinitySystem ?? WizConversationAffinitySystem.fromConfig(this._config)
    this.inventoryService = properties.inventoryService
    Object.freeze(this)
  }

  completeDialogueResult(vault: WizVaultValue, npcId: string): WizConversationResult {
    const npc = vault.npcs.find((candidate) => candidate.id === npcId)
    if (!npc) {
      return rejected(vault, { type: "npc_not_found", npcId })
    }

    const affinityResult = this._affinitySystem.changeAffinity(
      npc,
      this._config.dialogueAffinityBonus,
      { type: "dialogue_completed" },
    )
    const nextVault = vault.updateNpc(npcId, (current) => ({
      ...current,
      affinity: affinityResult.npc.affinity,
    }))

    return applied(nextVault, {
      type: "dialogue_completed",
      npcId,
      affinityChange: affinityResult.event,
    })
  }

  applyGiftResult(vault: WizVaultValue, npcId: string, gift: WizStateGift): WizConversationResult {
    const npc = vault.npcs.find((candidate) => candidate.id === npcId)
    if (!npc) {
      return rejected(vault, { type: "npc_not_found", npcId })
    }

    if (vault.inventory.totalQuantity("item", gift.itemId) === 0) {
      return rejected(vault, { type: "item_not_owned", itemId: gift.itemId })
    }

    const resolution = this._affinitySystem.resolveGift(npc.giftPreferences, gift.itemId)
    const affinityResult = this._affinitySystem.changeAffinity(npc, resolution.affinityChange, {
      type: "gift_received",
      itemId: gift.itemId,
    })

    const nextVault = vault
      .updateInventory((inventory) => this.inventoryService.consume(inventory, "item", gift.itemId))
      .updateNpc(npcId, (current) => ({
        ...current,
        affinity: affinityResult.npc.affinity,
      }))

    return applied(nextVault, {
      type: "gift_applied",
      npcId,
      itemId: gift.itemId,
      reaction: resolution.reaction,
      affinityBonus: resolution.affinityChange,
      affinityChange: affinityResult.event,
    })
  }
}

function applied(vault: WizVaultValue, event: WizConversationEvent): WizConversationResult {
  return Object.freeze({
    applied: true,
    vault,
    events: Object.freeze([Object.freeze({ ...event })]),
  })
}

function rejected(
  vault: WizVaultValue,
  rejection: WizConversationRejection,
): WizConversationResult {
  return Object.freeze({
    applied: false,
    vault,
    rejection: Object.freeze({ ...rejection }),
  })
}
