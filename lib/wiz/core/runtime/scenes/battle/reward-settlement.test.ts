import { describe, expect, it } from "vite-plus/test"
import { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import { WizBattleMonsterGroup } from "@/lib/wiz/core/engine/battle/actors/monster-group"
import { WizEngineBattleReward } from "@/lib/wiz/core/engine/reward/battle-reward"
import { wizMockPotion } from "@/lib/wiz/core/mocks/wiz-mock-potion"
import { wizMockGoblin } from "@/lib/wiz/core/mocks/wiz-mock-goblin"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { createMockInventoryService } from "@/lib/wiz/core/mocks/create-mock-inventory-service"
import {
  WizSceneBattleDefaultRewardSettlement,
  WizSceneBattleRewardSettlementResult,
} from "@/lib/wiz/core/runtime/scenes/battle/reward-settlement"
import { WizVaultValue } from "@/lib/wiz/core/vault/value"

const content = Object.freeze({
  items: Object.freeze({
    "item-potion": Object.freeze({
      id: "item-potion",
      name: "Potion",
      description: "Potion",
      itemType: "consumable" as const,
      price: 1,
      sellPrice: 1,
    }),
  }),
})
const inventoryService = createMockInventoryService(undefined, "reward-entry")

const createEnemies = () => {
  const first = wizMockGoblin(1)
  const second = wizMockGoblin(2)
  return new WizBattleEnemyParty({
    id: "settlement-enemies",
    groups: [
      new WizBattleMonsterGroup({
        id: "goblin",
        name: "Goblin",
        members: [
          new WizBattleMonster({ ...first.toProperties(), groupId: "goblin" }),
          new WizBattleMonster({ ...second.toProperties(), groupId: "goblin" }),
        ],
      }),
    ],
  })
}

describe("WizSceneBattleDefaultRewardSettlement", () => {
  it("標準報酬を各一度だけimmutable vaultへ反映する", () => {
    const item = wizMockPotion()
    const reward = new WizEngineBattleReward({
      experience: 12,
      gold: 7,
      droppedItems: [{ itemId: item.id, quantity: 3 }],
      custom: undefined,
    })
    const sourceVault = MOCK_VAULT.updateQuest("defeat_goblins", (quest) => ({
      ...quest,
      accepted: true,
    }))
    const sourceExperience = sourceVault.player.exp
    const sourceGold = sourceVault.player.gold
    const sourceAreaProgress = sourceVault.findArea("forest")?.progress
    const settlement = new WizSceneBattleDefaultRewardSettlement({
      content,
      inventoryService,
    })

    const result = settlement.settle({
      vault: sourceVault,
      reward,
      returnAreaId: "forest",
      enemies: createEnemies(),
    })
    expect(result.isAccepted()).toBe(true)
    const settled = result.vault

    expect(settled).not.toBe(sourceVault)
    expect(sourceVault.player.exp).toBe(sourceExperience)
    expect(sourceVault.player.gold).toBe(sourceGold)
    expect(sourceVault.inventory.totalQuantity("item", item.id)).toBe(0)
    expect(sourceVault.findArea("forest")?.progress).toBe(sourceAreaProgress)
    expect(settled.player.exp).toBe(sourceExperience + 12)
    expect(settled.player.gold).toBe(sourceGold + 7)
    expect(settled.inventory.totalQuantity("item", item.id)).toBe(3)
    expect(settled.findArea("forest")?.progress).toBe(
      (sourceAreaProgress ?? 0) + 10
    )
    expect(
      settled.log.filter(
        (message) =>
          message.key === "BATTLE_VICTORY" &&
          message.exp === 12 &&
          message.gold === 7
      )
    ).toHaveLength(1)
    const quest = settled.findQuest("defeat_goblins")
    expect(quest?.objective.type).toBe("defeat")
    if (quest?.objective.type === "defeat") {
      expect(quest.objective.current).toBe(2)
    }
    expect(Object.isFrozen(settlement)).toBe(true)
  })

  it("未知のitem dropを一件でも含む報酬は適用前に拒否する", () => {
    const settlement = new WizSceneBattleDefaultRewardSettlement({
      content,
      inventoryService,
    })
    const sourceVault = MOCK_VAULT
    const droppedItemResult = settlement.settle({
      vault: sourceVault,
      reward: new WizEngineBattleReward({
        experience: 12,
        gold: 7,
        droppedItems: [{ itemId: "unknown-drop", quantity: 2 }],
        custom: undefined,
      }),
      returnAreaId: "forest",
      enemies: createEnemies(),
    })

    expect(droppedItemResult.isRejected()).toBe(true)
    expect(droppedItemResult.reason).toBe("BATTLE_REWARD_ITEM_NOT_FOUND")
    expect(droppedItemResult.vault).toBe(sourceVault)
    expect(sourceVault.inventory.totalQuantity("item", "unknown-drop")).toBe(0)
    expect(
      sourceVault.log.some((message) => message.key === "BATTLE_VICTORY")
    ).toBe(false)
  })

  it("resultを固定し、標準settlementをbind不要かつ再代入不可にする", () => {
    const result = WizSceneBattleRewardSettlementResult.accept(MOCK_VAULT)
    const forged = Object.create(
      WizSceneBattleRewardSettlementResult.prototype
    ) as WizSceneBattleRewardSettlementResult
    const settlement = new WizSceneBattleDefaultRewardSettlement({
      content,
      inventoryService,
    })
    const detachedSettle = settlement.settle
    const detachedResult = detachedSettle({
      vault: MOCK_VAULT,
      reward: new WizEngineBattleReward({
        experience: 0,
        gold: 0,
        droppedItems: [],
        custom: undefined,
      }),
      returnAreaId: "forest",
      enemies: createEnemies(),
    })

    expect(Object.isFrozen(WizSceneBattleRewardSettlementResult)).toBe(true)
    expect(
      Object.isFrozen(WizSceneBattleRewardSettlementResult.prototype)
    ).toBe(true)
    expect(Object.isFrozen(WizSceneBattleDefaultRewardSettlement)).toBe(true)
    expect(
      Object.isFrozen(WizSceneBattleDefaultRewardSettlement.prototype)
    ).toBe(true)
    expect(Object.isFrozen(settlement)).toBe(true)
    expect(
      Object.hasOwn(WizSceneBattleDefaultRewardSettlement.prototype, "settle")
    ).toBe(false)
    expect(Object.hasOwn(settlement, "settle")).toBe(true)
    expect(detachedResult.isAccepted()).toBe(true)
    expect(Reflect.set(settlement, "settle", () => result)).toBe(false)
    expect(result.isAccepted()).toBe(true)
    expect(() => forged.mapVault((vault) => vault)).toThrow(
      "Battle reward settlement must return an authentic WizSceneBattleRewardSettlementResult"
    )
    expect(() => forged.isAccepted()).toThrow(
      "Battle reward settlement must return an authentic WizSceneBattleRewardSettlementResult"
    )
    expect(() => forged.isRejected()).toThrow(
      "Battle reward settlement must return an authentic WizSceneBattleRewardSettlementResult"
    )
  })

  it("真正でないvaultをresult生成とmapVaultの境界で拒否する", () => {
    const forgedVault = Object.create(WizVaultValue.prototype)
    const accepted = WizSceneBattleRewardSettlementResult.accept(MOCK_VAULT)

    expect(() =>
      WizSceneBattleRewardSettlementResult.accept(forgedVault)
    ).toThrow("Vault must be an authentic WizVaultValue")
    expect(() =>
      WizSceneBattleRewardSettlementResult.reject(forgedVault, "FORGED_VAULT")
    ).toThrow("Vault must be an authentic WizVaultValue")
    expect(() => accepted.mapVault(() => forgedVault)).toThrow(
      "Vault must be an authentic WizVaultValue"
    )
  })

  it("真正でないvaultは標準settlementが処理する前に拒否する", () => {
    let updateCalled = false
    const forgedVault = Object.create(WizVaultValue.prototype)
    Object.defineProperty(forgedVault, "updatePlayer", {
      value: () => {
        updateCalled = true
        return forgedVault
      },
    })
    const settlement = new WizSceneBattleDefaultRewardSettlement({
      content,
      inventoryService,
    })

    expect(() =>
      settlement.settle({
        vault: forgedVault,
        reward: new WizEngineBattleReward({
          experience: 1,
          gold: 1,
          droppedItems: [],
          custom: undefined,
        }),
        returnAreaId: "forest",
        enemies: createEnemies(),
      })
    ).toThrow("Vault must be an authentic WizVaultValue")
    expect(updateCalled).toBe(false)
  })
})
