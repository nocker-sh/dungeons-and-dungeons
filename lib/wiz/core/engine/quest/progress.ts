import { createWizStandardConversationAffinitySystem } from "@/lib/wiz/core/engine/conversation/create-wiz-standard-conversation-affinity-system"
import type { WizConversationAffinityPort } from "@/lib/wiz/core/engine/conversation/create-wiz-standard-conversation-affinity-system"
import type { WizStandardInventoryService } from "@/lib/wiz/core/rpg/standard-inventory"
import type { WizVaultQuestState } from "@/lib/wiz/core/vault/states/quest/schema"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

type Properties = {
  readonly affinitySystem?: WizConversationAffinityPort
  readonly inventoryService: WizStandardInventoryService
}

export type WizEngineQuestCompletionRejection =
  | {
      readonly type: "quest_not_found"
      readonly questId: string
    }
  | {
      readonly type: "quest_not_accepted"
      readonly questId: string
    }
  | {
      readonly type: "quest_already_completed"
      readonly questId: string
    }
  | {
      readonly type: "objective_target_not_found"
      readonly questId: string
      readonly objectiveType: "explore"
      readonly targetId: string
    }
  | {
      readonly type: "objective_incomplete"
      readonly questId: string
      readonly objectiveType: WizVaultQuestState["objective"]["type"]
      readonly targetId: string
      readonly current: number
      readonly required: number
    }

export type WizEngineQuestCompletionCheckResult =
  | {
      readonly canComplete: true
      readonly questId: string
    }
  | {
      readonly canComplete: false
      readonly questId: string
      readonly rejection: WizEngineQuestCompletionRejection
    }

export type WizEngineQuestCompletedEvent = {
  readonly type: "quest_completed"
  readonly questId: string
  readonly reward: Readonly<{
    readonly gold: number
    readonly exp: number
    readonly affinityBonus: number
  }>
}

export type WizEngineQuestCompletionResult =
  | {
      readonly completed: true
      readonly vault: WizVaultValue
      readonly event: WizEngineQuestCompletedEvent
    }
  | {
      readonly completed: false
      readonly vault: WizVaultValue
      readonly rejection: WizEngineQuestCompletionRejection
    }

export class WizEngineQuestProgress {
  private readonly affinitySystem: WizConversationAffinityPort
  private readonly inventoryService: WizStandardInventoryService

  constructor(properties: Properties) {
    this.affinitySystem =
      properties.affinitySystem ?? createWizStandardConversationAffinitySystem()
    this.inventoryService = properties.inventoryService
    Object.freeze(this)
  }

  checkCompletion(
    vault: WizVaultValue,
    questId: string
  ): WizEngineQuestCompletionCheckResult {
    const quest = vault.quests.find((q) => q.id === questId)
    if (!quest) {
      return rejectedCheck({
        type: "quest_not_found",
        questId,
      })
    }
    if (!quest.accepted) {
      return rejectedCheck({
        type: "quest_not_accepted",
        questId,
      })
    }
    if (quest.completed) {
      return rejectedCheck({
        type: "quest_already_completed",
        questId,
      })
    }

    const objective = quest.objective
    if (objective.type === "defeat") {
      return objective.current >= objective.count
        ? completedCheck(questId)
        : rejectedCheck({
            type: "objective_incomplete",
            questId,
            objectiveType: objective.type,
            targetId: objective.monsterId,
            current: objective.current,
            required: objective.count,
          })
    }
    if (objective.type === "gather") {
      const itemCount = vault.inventory.totalQuantity("item", objective.itemId)
      return itemCount >= objective.count
        ? completedCheck(questId)
        : rejectedCheck({
            type: "objective_incomplete",
            questId,
            objectiveType: objective.type,
            targetId: objective.itemId,
            current: itemCount,
            required: objective.count,
          })
    }
    if (objective.type === "explore") {
      const area = vault.areas.find((a) => a.id === objective.areaId)
      if (!area) {
        return rejectedCheck({
          type: "objective_target_not_found",
          questId,
          objectiveType: objective.type,
          targetId: objective.areaId,
        })
      }
      return area.progress >= objective.requiredProgress
        ? completedCheck(questId)
        : rejectedCheck({
            type: "objective_incomplete",
            questId,
            objectiveType: objective.type,
            targetId: objective.areaId,
            current: area.progress,
            required: objective.requiredProgress,
          })
    }
    const itemCount = vault.inventory.totalQuantity("item", objective.itemId)
    return itemCount >= 1
      ? completedCheck(questId)
      : rejectedCheck({
          type: "objective_incomplete",
          questId,
          objectiveType: objective.type,
          targetId: objective.itemId,
          current: itemCount,
          required: 1,
        })
  }

  canComplete(vault: WizVaultValue, questId: string): boolean {
    return this.checkCompletion(vault, questId).canComplete
  }

  completeResult(
    vault: WizVaultValue,
    questId: string
  ): WizEngineQuestCompletionResult {
    const check = this.checkCompletion(vault, questId)
    if (!check.canComplete) {
      return Object.freeze({
        completed: false,
        vault,
        rejection: check.rejection,
      })
    }

    const quest = vault.quests.find((candidate) => candidate.id === questId)
    if (!quest) {
      return Object.freeze({
        completed: false,
        vault,
        rejection: Object.freeze({
          type: "quest_not_found",
          questId,
        }),
      })
    }

    const completedVault = this.applyCompletion(vault, quest)
    return Object.freeze({
      completed: true,
      vault: completedVault,
      event: Object.freeze({
        type: "quest_completed",
        questId,
        reward: Object.freeze({
          gold: quest.reward.gold,
          exp: quest.reward.exp,
          affinityBonus: quest.reward.affinityBonus,
        }),
      }),
    })
  }

  private applyCompletion(
    vault: WizVaultValue,
    quest: WizVaultQuestState
  ): WizVaultValue {
    let newVault = vault
      .updatePlayer((p) =>
        p.addGold(quest.reward.gold).addExp(quest.reward.exp)
      )
      .updateQuest(quest.id, (q) => ({ ...q, completed: true }))
      .updateNpc(
        quest.giverNpcId,
        (npc) =>
          this.affinitySystem.changeAffinity(npc, quest.reward.affinityBonus, {
            type: "quest_reward",
            questId: quest.id,
          }).npc
      )

    const objective = quest.objective
    if (objective.type === "gather") {
      newVault = newVault.updateInventory((inv) =>
        this.inventoryService.consume(
          inv,
          "item",
          objective.itemId,
          objective.count
        )
      )
    }

    if (objective.type === "deliver") {
      newVault = newVault.updateInventory((inventory) =>
        this.inventoryService.consume(inventory, "item", objective.itemId)
      )
    }

    if (quest.reward.items) {
      newVault = quest.reward.items.reduce((currentVault, reward) => {
        if (reward.type === "weapon") {
          return currentVault.updateInventory((inventory) =>
            this.inventoryService.add(
              inventory,
              "weapon",
              reward.weaponId,
              reward.quantity
            )
          )
        }
        if (reward.type === "armor") {
          return currentVault.updateInventory((inventory) =>
            this.inventoryService.add(
              inventory,
              "armor",
              reward.armorId,
              reward.quantity
            )
          )
        }
        return currentVault
          .updateInventory((inventory) =>
            this.inventoryService.add(
              inventory,
              "item",
              reward.itemId,
              reward.quantity
            )
          )
          .addLog({
            key: "QUEST_REWARD_ITEM",
            itemId: reward.itemId,
            quantity: reward.quantity,
          })
      }, newVault)
    }

    if (quest.nextQuestId) {
      const nextQuest = newVault.quests.find((q) => q.id === quest.nextQuestId)
      if (nextQuest && !nextQuest.accepted && !nextQuest.completed) {
        newVault = newVault.addLog({
          key: "QUEST_CHAIN_UNLOCKED",
          questId: quest.nextQuestId,
        })
      }
    }

    return newVault
  }
}

function completedCheck(questId: string): WizEngineQuestCompletionCheckResult {
  return Object.freeze({
    canComplete: true,
    questId,
  })
}

function rejectedCheck(
  rejection: WizEngineQuestCompletionRejection
): WizEngineQuestCompletionCheckResult {
  const ownedRejection = Object.freeze({ ...rejection })
  return Object.freeze({
    canComplete: false,
    questId: rejection.questId,
    rejection: ownedRejection,
  })
}
