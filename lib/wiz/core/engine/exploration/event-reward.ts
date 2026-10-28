import type { WizVaultValue } from "@/lib/wiz/core/vault/value"
import type { WizStandardInventoryService } from "@/lib/wiz/core/rpg/standard-inventory"

export type WizEngineEventReward = Readonly<{
  gold?: number
  exp?: number
  items?: readonly Readonly<{ itemId: string; quantity: number }>[]
}>

export type WizEngineEventPenalty = Readonly<{
  hpLoss?: number
  goldLoss?: number
  hungerLoss?: number
}>

/**
 * 探索イベントの報酬・ペナルティを vault に反映する差し替え可能インターフェース。
 *
 * 既定実装は {@link WizEngineExplorationEventReward}。
 * カスタム挙動 (例: 報酬を増幅する luck カスタム属性、ペナルティ無効化スキル) を
 * 入れたい場合は本 port を実装し、`WizSceneExplorationReducer` の
 * `rewardService` 依存に渡す。
 */
export type WizEngineExplorationEventRewardService = Readonly<{
  readonly applyReward: (
    vault: WizVaultValue,
    reward: WizEngineEventReward | undefined,
  ) => WizVaultValue
  readonly applyPenalty: (
    vault: WizVaultValue,
    penalty: WizEngineEventPenalty | undefined,
  ) => WizVaultValue
}>

export class WizEngineExplorationEventReward implements WizEngineExplorationEventRewardService {
  private readonly inventoryService: WizStandardInventoryService

  constructor(inventoryService: WizStandardInventoryService) {
    this.inventoryService = inventoryService
    Object.freeze(this)
  }

  readonly applyReward = (
    vault: WizVaultValue,
    reward: WizEngineEventReward | undefined,
  ): WizVaultValue => {
    if (!reward) return vault

    let result = vault
    if (reward.gold) {
      result = result.updatePlayer((p) => p.addGold(reward.gold ?? 0))
    }
    if (reward.exp) {
      result = result.updatePlayer((p) => p.addExp(reward.exp ?? 0))
    }
    if (reward.items) {
      for (const item of reward.items) {
        result = result.updateInventory((inventory) =>
          this.inventoryService.add(inventory, "item", item.itemId, item.quantity),
        )
      }
    }
    return result
  }

  readonly applyPenalty = (
    vault: WizVaultValue,
    penalty: WizEngineEventPenalty | undefined,
  ): WizVaultValue => {
    if (!penalty) return vault

    let result = vault
    if (penalty.hpLoss) {
      result = result.updatePlayer((p) => p.damage(penalty.hpLoss ?? 0))
    }
    if (penalty.goldLoss) {
      result = result.updatePlayer((p) => p.spendGold(penalty.goldLoss ?? 0))
    }
    if (penalty.hungerLoss) {
      result = result.updatePlayer((p) => p.addHunger(-(penalty.hungerLoss ?? 0)))
    }
    return result
  }
}

Object.freeze(WizEngineExplorationEventReward.prototype)
Object.freeze(WizEngineExplorationEventReward)
