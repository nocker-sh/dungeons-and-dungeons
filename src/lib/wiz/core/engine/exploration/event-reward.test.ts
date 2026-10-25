import { describe, expect, it } from "vite-plus/test"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import {
  WizEngineExplorationEventReward,
  type WizEngineEventPenalty,
  type WizEngineEventReward,
  type WizEngineExplorationEventRewardService,
} from "@/lib/wiz/core/engine/exploration/event-reward"
import { createMockInventoryService } from "@/lib/wiz/core/mocks/mock-inventory"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

const service = new WizEngineExplorationEventReward(createMockInventoryService())

const verifyRewardServiceContract = (
  port: WizEngineExplorationEventRewardService,
  reward: WizEngineEventReward,
  penalty: WizEngineEventPenalty,
): void => {
  // @ts-expect-error port callbackはreadonly。
  port.applyReward = () => MOCK_VAULT
  // @ts-expect-error 報酬definitionはreadonly。
  reward.gold = 999
  // @ts-expect-error 報酬item配列はreadonly。
  reward.items?.push({ itemId: "forged-item", quantity: 1 })
  if (reward.items?.[0]) {
    // @ts-expect-error 報酬item要素もreadonly。
    reward.items[0].quantity = 999
  }
  // @ts-expect-error ペナルティdefinitionはreadonly。
  penalty.hpLoss = 999

  const narrowerPort = {
    applyReward: (
      vault: WizVaultValue,
      requiredReward: Readonly<{ gold: number }>,
    ): WizVaultValue => {
      void requiredReward
      return vault
    },
    applyPenalty: (
      vault: WizVaultValue,
      requiredPenalty: Readonly<{ hpLoss: number }>,
    ): WizVaultValue => {
      void requiredPenalty
      return vault
    },
  }
  // @ts-expect-error optionalな全報酬を扱えないcallbackはportを満たさない。
  const invalidPort: WizEngineExplorationEventRewardService = narrowerPort
  void invalidPort
}

void verifyRewardServiceContract

describe("applyReward", () => {
  it("ゴールドを獲得できる", () => {
    const vault = MOCK_VAULT
    const initialGold = vault.player.gold
    const { applyReward } = service

    const newVault = applyReward(vault, { gold: 50 })

    expect(newVault.player.gold).toBe(initialGold + 50)
    expect(Object.isFrozen(service)).toBe(true)
  })

  it("経験値を獲得できる", () => {
    const vault = MOCK_VAULT
    const initialExp = vault.player.exp

    const newVault = service.applyReward(vault, { exp: 100 })

    expect(newVault.player.exp).toBe(initialExp + 100)
  })

  it("複数の報酬を同時に獲得できる", () => {
    const vault = MOCK_VAULT
    const initialGold = vault.player.gold
    const initialExp = vault.player.exp

    const newVault = service.applyReward(vault, { gold: 30, exp: 50 })

    expect(newVault.player.gold).toBe(initialGold + 30)
    expect(newVault.player.exp).toBe(initialExp + 50)
  })

  it("報酬がundefinedの場合は変更なし", () => {
    const vault = MOCK_VAULT

    const newVault = service.applyReward(vault, undefined)

    expect(newVault.player.gold).toBe(vault.player.gold)
    expect(newVault.player.exp).toBe(vault.player.exp)
  })

  it("空の報酬オブジェクトの場合は変更なし", () => {
    const vault = MOCK_VAULT

    const newVault = service.applyReward(vault, {})

    expect(newVault.player.gold).toBe(vault.player.gold)
  })
})

describe("applyPenalty", () => {
  it("HPダメージを受ける", () => {
    const vault = MOCK_VAULT
    const initialHp = vault.player.hp
    const { applyPenalty } = service

    const newVault = applyPenalty(vault, { hpLoss: 20 })

    expect(newVault.player.hp).toBe(initialHp - 20)
  })

  it("ゴールドを失う", () => {
    const vault = MOCK_VAULT.updatePlayer((p) => p.addGold(100))
    const initialGold = vault.player.gold

    const newVault = service.applyPenalty(vault, { goldLoss: 30 })

    expect(newVault.player.gold).toBe(initialGold - 30)
  })

  it("複数のペナルティを同時に受ける", () => {
    const vault = MOCK_VAULT.updatePlayer((p) => p.addGold(100))
    const initialHp = vault.player.hp
    const initialGold = vault.player.gold

    const newVault = service.applyPenalty(vault, { hpLoss: 10, goldLoss: 20 })

    expect(newVault.player.hp).toBe(initialHp - 10)
    expect(newVault.player.gold).toBe(initialGold - 20)
  })

  it("ペナルティがundefinedの場合は変更なし", () => {
    const vault = MOCK_VAULT

    const newVault = service.applyPenalty(vault, undefined)

    expect(newVault.player.hp).toBe(vault.player.hp)
  })

  it("空のペナルティオブジェクトの場合は変更なし", () => {
    const vault = MOCK_VAULT

    const newVault = service.applyPenalty(vault, {})

    expect(newVault.player.hp).toBe(vault.player.hp)
  })
})
