import type { WizContentDialogueEffects } from "@/lib/wiz/core/definition/npc/dialogue"
import {
  createWizStandardConversationAffinitySystem,
  type WizConversationAffinityPort,
} from "@/lib/wiz/core/engine/conversation/affinity-system"
import { createWizConversationDialogueUnlockFlag } from "@/lib/wiz/core/engine/conversation/dialogue-selector"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { WizStandardInventoryService } from "@/lib/wiz/core/rpg/standard-inventory"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

type Properties = {
  readonly affinitySystem?: WizConversationAffinityPort
  readonly inventoryService: WizStandardInventoryService
}

export class WizEngineDialogueEffectApplicator {
  private readonly affinitySystem: WizConversationAffinityPort
  private readonly inventoryService: WizStandardInventoryService

  constructor(properties: Properties) {
    this.affinitySystem = properties.affinitySystem ?? createWizStandardConversationAffinitySystem()
    this.inventoryService = properties.inventoryService
    Object.freeze(this)
  }

  canApply(vault: WizVaultValue, effects: WizDeepReadonly<WizContentDialogueEffects>): boolean {
    if (effects.affinityChange !== undefined && !Number.isFinite(effects.affinityChange)) {
      return false
    }
    const validGiveItems =
      effects.giveItems?.every(
        (item) =>
          Number.isFinite(item.quantity) && Number.isInteger(item.quantity) && item.quantity > 0,
      ) ?? true
    if (!validGiveItems) return false

    const takeItems = effects.takeItems ?? []
    return takeItems.every((item, index) => {
      if (
        !Number.isFinite(item.quantity) ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return false
      }
      if (takeItems.findIndex((candidate) => candidate.itemId === item.itemId) !== index) {
        return true
      }
      const totalQuantity = takeItems.reduce(
        (total, candidate) =>
          candidate.itemId === item.itemId ? total + candidate.quantity : total,
        0,
      )
      return vault.inventory.totalQuantity("item", item.itemId) >= totalQuantity
    })
  }

  apply(
    vault: WizVaultValue,
    npcId: string,
    effects: WizDeepReadonly<WizContentDialogueEffects>,
  ): WizVaultValue {
    if (!this.canApply(vault, effects)) return vault

    let result = vault

    if (effects.affinityChange) {
      result = result.updateNpc(
        npcId,
        (npc) =>
          this.affinitySystem.changeAffinity(npc, effects.affinityChange ?? 0, {
            type: "dialogue_effect",
          }).npc,
      )
    }

    if (effects.giveItems) {
      for (const item of effects.giveItems) {
        result = result.updateInventory((inventory) =>
          this.inventoryService.add(inventory, "item", item.itemId, item.quantity),
        )
      }
    }

    if (effects.takeItems) {
      for (const item of effects.takeItems) {
        result = result.updateInventory((inventory) =>
          this.inventoryService.consume(inventory, "item", item.itemId, item.quantity),
        )
      }
    }

    if (effects.setFlags) {
      for (const flag of effects.setFlags) {
        result = result.addFlag(flag)
      }
    }

    if (effects.removeFlags) {
      for (const flag of effects.removeFlags) {
        result = result.removeFlag(flag)
      }
    }

    if (effects.startQuest) {
      result = result.updateQuest(effects.startQuest, (q) => ({
        ...q,
        accepted: true,
      }))
    }

    if (effects.completeQuest) {
      result = result.updateQuest(effects.completeQuest, (q) => ({
        ...q,
        completed: true,
      }))
    }

    if (effects.unlockDialogue) {
      result = result.addFlag(
        createWizConversationDialogueUnlockFlag(npcId, effects.unlockDialogue),
      )
    }

    return result
  }
}
