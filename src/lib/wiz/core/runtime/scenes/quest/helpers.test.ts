import { describe, expect, it } from "vite-plus/test"
import { MOCK_INITIAL_STATE } from "@/lib/wiz/core/mocks/mock-vault"
import { WizEngineQuestProgress } from "@/lib/wiz/core/engine/quest/progress"
import { createMockInventoryService, withMockInventory } from "@/lib/wiz/core/mocks/mock-inventory"
import type { WizVaultQuestState } from "@/lib/wiz/core/vault/states/quest/schema"

const createDefeatQuest = (): WizVaultQuestState => ({
  id: "test-defeat-quest",
  name: "スライム討伐",
  description: "スライムを3体倒せ",
  giverNpcId: "test-npc",
  accepted: true,
  completed: false,
  objective: {
    type: "defeat",
    monsterId: "slime",
    count: 3,
    current: 0,
  },
  reward: {
    gold: 100,
    exp: 50,
    affinityBonus: 0,
  },
})

const createGatherQuest = (): WizVaultQuestState => ({
  id: "test-gather-quest",
  name: "薬草集め",
  description: "薬草を5個集めろ",
  giverNpcId: "test-npc",
  accepted: true,
  completed: false,
  objective: {
    type: "gather",
    itemId: "herb",
    count: 5,
    current: 0,
  },
  reward: {
    gold: 50,
    exp: 30,
    affinityBonus: 0,
  },
})

const createExploreQuest = (): WizVaultQuestState => ({
  id: "test-explore-quest",
  name: "森の探索",
  description: "森を50%まで探索せよ",
  giverNpcId: "test-npc",
  accepted: true,
  completed: false,
  objective: {
    type: "explore",
    areaId: "forest",
    requiredProgress: 50,
  },
  reward: {
    gold: 200,
    exp: 100,
    affinityBonus: 0,
  },
})

describe("updateQuestProgressDefeat", () => {
  it("討伐進捗を更新する", () => {
    const quest = createDefeatQuest()
    const vault = MOCK_INITIAL_STATE.vault.withQuests([quest])

    const newVault = vault.updateQuestProgressDefeat("slime")

    const updatedQuest = newVault.quests.find(
      (q: WizVaultQuestState) => q.id === "test-defeat-quest",
    )
    expect(updatedQuest?.objective.type).toBe("defeat")
    if (updatedQuest?.objective.type === "defeat") {
      expect(updatedQuest.objective.current).toBe(1)
    }
  })

  it("受注していないクエストは更新しない", () => {
    const quest: WizVaultQuestState = {
      ...createDefeatQuest(),
      accepted: false,
    }
    const vault = MOCK_INITIAL_STATE.vault.withQuests([quest])

    const newVault = vault.updateQuestProgressDefeat("slime")

    const updatedQuest = newVault.quests.find(
      (q: WizVaultQuestState) => q.id === "test-defeat-quest",
    )
    if (updatedQuest?.objective.type === "defeat") {
      expect(updatedQuest.objective.current).toBe(0)
    }
  })

  it("完了済みのクエストは更新しない", () => {
    const quest: WizVaultQuestState = {
      ...createDefeatQuest(),
      completed: true,
    }
    const vault = MOCK_INITIAL_STATE.vault.withQuests([quest])

    const newVault = vault.updateQuestProgressDefeat("slime")

    const updatedQuest = newVault.quests.find(
      (q: WizVaultQuestState) => q.id === "test-defeat-quest",
    )
    if (updatedQuest?.objective.type === "defeat") {
      expect(updatedQuest.objective.current).toBe(0)
    }
  })

  it("別のモンスターIDでは更新しない", () => {
    const quest = createDefeatQuest()
    const vault = MOCK_INITIAL_STATE.vault.withQuests([quest])

    const newVault = vault.updateQuestProgressDefeat("goblin")

    const updatedQuest = newVault.quests.find(
      (q: WizVaultQuestState) => q.id === "test-defeat-quest",
    )
    if (updatedQuest?.objective.type === "defeat") {
      expect(updatedQuest.objective.current).toBe(0)
    }
  })

  it("目標数を超えない", () => {
    const quest: WizVaultQuestState = {
      ...createDefeatQuest(),
      objective: {
        type: "defeat",
        monsterId: "slime",
        count: 3,
        current: 2,
      },
    }
    const vault = MOCK_INITIAL_STATE.vault.withQuests([quest])

    const newVault = vault.updateQuestProgressDefeat("slime").updateQuestProgressDefeat("slime")

    const updatedQuest = newVault.quests.find(
      (q: WizVaultQuestState) => q.id === "test-defeat-quest",
    )
    if (updatedQuest?.objective.type === "defeat") {
      expect(updatedQuest.objective.current).toBe(3) // 上限
    }
  })
})

describe("updateQuestProgressGather", () => {
  it("収集進捗をインベントリ数量で更新する", () => {
    const quest = createGatherQuest()
    const vault = withMockInventory(MOCK_INITIAL_STATE.vault.withQuests([quest]), [
      { contentType: "item", contentId: "herb", quantity: 3 },
    ])

    const newVault = vault.updateQuestProgressGather("herb")

    const updatedQuest = newVault.quests.find(
      (q: WizVaultQuestState) => q.id === "test-gather-quest",
    )
    if (updatedQuest?.objective.type === "gather") {
      expect(updatedQuest.objective.current).toBe(3)
    }
  })

  it("アイテムがない場合は0になる", () => {
    const quest = createGatherQuest()
    const vault = MOCK_INITIAL_STATE.vault.withQuests([quest])

    const newVault = vault.updateQuestProgressGather("herb")

    const updatedQuest = newVault.quests.find(
      (q: WizVaultQuestState) => q.id === "test-gather-quest",
    )
    if (updatedQuest?.objective.type === "gather") {
      expect(updatedQuest.objective.current).toBe(0)
    }
  })
})

describe("WizSceneQuestProgressService.canComplete", () => {
  const service = new WizEngineQuestProgress({
    inventoryService: createMockInventoryService(undefined, "quest-helper-entry"),
  })

  it("討伐目標達成で完了可能", () => {
    const quest: WizVaultQuestState = {
      ...createDefeatQuest(),
      objective: {
        type: "defeat",
        monsterId: "slime",
        count: 3,
        current: 3,
      },
    }
    const state = MOCK_INITIAL_STATE.withVault(MOCK_INITIAL_STATE.vault.withQuests([quest]))

    expect(service.canComplete(state.vault, "test-defeat-quest")).toBe(true)
  })

  it("討伐目標未達成で完了不可", () => {
    const quest: WizVaultQuestState = {
      ...createDefeatQuest(),
      objective: {
        type: "defeat",
        monsterId: "slime",
        count: 3,
        current: 2,
      },
    }
    const state = MOCK_INITIAL_STATE.withVault(MOCK_INITIAL_STATE.vault.withQuests([quest]))

    expect(service.canComplete(state.vault, "test-defeat-quest")).toBe(false)
  })

  it("収集クエストはインベントリで判定", () => {
    const quest = createGatherQuest()
    const state = MOCK_INITIAL_STATE.withVault(
      withMockInventory(MOCK_INITIAL_STATE.vault.withQuests([quest]), [
        { contentType: "item", contentId: "herb", quantity: 5 },
      ]),
    )

    expect(service.canComplete(state.vault, "test-gather-quest")).toBe(true)
  })

  it("収集クエストでアイテム不足は完了不可", () => {
    const quest = createGatherQuest()
    const state = MOCK_INITIAL_STATE.withVault(
      withMockInventory(MOCK_INITIAL_STATE.vault.withQuests([quest]), [
        { contentType: "item", contentId: "herb", quantity: 3 },
      ]),
    )

    expect(service.canComplete(state.vault, "test-gather-quest")).toBe(false)
  })

  it("探索クエストはエリア進捗で判定", () => {
    const quest = createExploreQuest()
    const state = MOCK_INITIAL_STATE.withVault(
      MOCK_INITIAL_STATE.vault
        .withQuests([quest])
        .updateArea("forest", (a) => ({ ...a, progress: 50 })),
    )

    expect(service.canComplete(state.vault, "test-explore-quest")).toBe(true)
  })

  it("受注していないクエストは完了不可", () => {
    const quest: WizVaultQuestState = {
      ...createDefeatQuest(),
      accepted: false,
    }
    const state = MOCK_INITIAL_STATE.withVault(MOCK_INITIAL_STATE.vault.withQuests([quest]))

    expect(service.canComplete(state.vault, "test-defeat-quest")).toBe(false)
  })

  it("既に完了済みのクエストは完了不可", () => {
    const quest: WizVaultQuestState = {
      ...createDefeatQuest(),
      completed: true,
    }
    const state = MOCK_INITIAL_STATE.withVault(MOCK_INITIAL_STATE.vault.withQuests([quest]))

    expect(service.canComplete(state.vault, "test-defeat-quest")).toBe(false)
  })

  it("存在しないクエストIDは完了不可", () => {
    const state = MOCK_INITIAL_STATE.withVault(MOCK_INITIAL_STATE.vault.withQuests([]))

    expect(service.canComplete(state.vault, "non-existent-quest")).toBe(false)
  })
})
