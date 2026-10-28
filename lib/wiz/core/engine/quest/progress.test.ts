import { expect, test } from "vite-plus/test"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WizConversationAffinitySystem } from "@/lib/wiz/core/engine/conversation/create-wiz-standard-conversation-affinity-system"
import { WizEngineQuestProgress } from "@/lib/wiz/core/engine/quest/progress"
import { createMockInventoryService } from "@/lib/wiz/core/mocks/create-mock-inventory-service"
import { withMockInventory } from "@/lib/wiz/core/mocks/with-mock-inventory"
import type { WizVaultQuestState } from "@/lib/wiz/core/vault/states/quest/schema"

const inventoryService = createMockInventoryService()
const service = new WizEngineQuestProgress({ inventoryService })

const createDefeatQuest = (current: number): WizVaultQuestState => ({
  id: "defeat_quest",
  name: "討伐クエスト",
  description: "スライムを3体倒せ",
  giverNpcId: "elda",
  objective: {
    type: "defeat",
    monsterId: "slime",
    count: 3,
    current,
  },
  reward: { gold: 100, exp: 50, affinityBonus: 0 },
  completed: false,
  accepted: true,
})

const createGatherQuest = (): WizVaultQuestState => ({
  id: "gather_quest",
  name: "採取クエスト",
  description: "薬草を5個集めろ",
  giverNpcId: "elda",
  objective: {
    type: "gather",
    itemId: "herb",
    count: 5,
    current: 0,
  },
  reward: { gold: 50, exp: 30, affinityBonus: 0 },
  completed: false,
  accepted: true,
})

const createExploreQuest = (): WizVaultQuestState => ({
  id: "explore_quest",
  name: "探索クエスト",
  description: "森を探索しろ",
  giverNpcId: "elda",
  objective: {
    type: "explore",
    areaId: "forest",
    requiredProgress: 50,
  },
  reward: { gold: 80, exp: 40, affinityBonus: 10 },
  completed: false,
  accepted: true,
})

const withCompletableExploreQuest = (quest: WizVaultQuestState) =>
  MOCK_VAULT.withQuests([quest]).updateArea("forest", (area) => ({
    ...area,
    progress: 50,
  }))

test("canComplete は defeat タイプで current >= count の場合 true を返す", () => {
  const quest = createDefeatQuest(3)
  const vault = MOCK_VAULT.withQuests([quest])

  const result = service.canComplete(vault, "defeat_quest")

  expect(result).toBe(true)
})

test("canComplete は defeat タイプで current < count の場合 false を返す", () => {
  const quest = createDefeatQuest(2)
  const vault = MOCK_VAULT.withQuests([quest])

  const result = service.canComplete(vault, "defeat_quest")

  expect(result).toBe(false)
})

test("canComplete は gather タイプでインベントリにアイテムがある場合 true を返す", () => {
  const quest = createGatherQuest()
  const vaultWithQuest = MOCK_VAULT.withQuests([quest])
  const vaultWithItems = withMockInventory(vaultWithQuest, [
    { contentType: "item", contentId: "herb", quantity: 5 },
  ])

  const result = service.canComplete(vaultWithItems, "gather_quest")

  expect(result).toBe(true)
})

test("canComplete は gather タイプでアイテムが足りない場合 false を返す", () => {
  const quest = createGatherQuest()
  const vaultWithQuest = MOCK_VAULT.withQuests([quest])
  const vaultWithItems = withMockInventory(vaultWithQuest, [
    { contentType: "item", contentId: "herb", quantity: 3 },
  ])

  const result = service.canComplete(vaultWithItems, "gather_quest")

  expect(result).toBe(false)
})

test("canComplete は explore タイプでエリア進捗が条件を満たす場合 true を返す", () => {
  const quest = createExploreQuest()
  const vaultWithQuest = withCompletableExploreQuest(quest)
  const vaultWithProgress = vaultWithQuest.updateArea("forest", (a) => ({
    ...a,
    progress: 50,
  }))

  const result = service.canComplete(vaultWithProgress, "explore_quest")

  expect(result).toBe(true)
})

test("canComplete は explore タイプでエリア進捗が足りない場合 false を返す", () => {
  const quest = createExploreQuest()
  const vaultWithQuest = MOCK_VAULT.withQuests([quest])

  const result = service.canComplete(vaultWithQuest, "explore_quest")

  expect(result).toBe(false)
})

test("canComplete は未受注のクエストの場合 false を返す", () => {
  const quest: WizVaultQuestState = { ...createDefeatQuest(3), accepted: false }
  const vault = MOCK_VAULT.withQuests([quest])

  const result = service.canComplete(vault, "defeat_quest")

  expect(result).toBe(false)
})

test("canComplete は完了済みクエストの場合 false を返す", () => {
  const quest: WizVaultQuestState = { ...createDefeatQuest(3), completed: true }
  const vault = MOCK_VAULT.withQuests([quest])

  const result = service.canComplete(vault, "defeat_quest")

  expect(result).toBe(false)
})

test("canComplete は存在しないクエストの場合 false を返す", () => {
  const result = service.canComplete(MOCK_VAULT, "nonexistent")

  expect(result).toBe(false)
})

test("checkCompletion は未完了の進捗をsemantic rejectionとして返す", () => {
  const quest = createDefeatQuest(2)
  const vault = MOCK_VAULT.withQuests([quest])

  const result = service.checkCompletion(vault, quest.id)

  expect(result).toEqual({
    canComplete: false,
    questId: quest.id,
    rejection: {
      type: "objective_incomplete",
      questId: quest.id,
      objectiveType: "defeat",
      targetId: "slime",
      current: 2,
      required: 3,
    },
  })
  expect(Object.isFrozen(result)).toBe(true)
  if (!result.canComplete) {
    expect(Object.isFrozen(result.rejection)).toBe(true)
  }
})

test("completeResult は完了eventと新しいvaultを返す", () => {
  const quest = createDefeatQuest(3)
  const vault = MOCK_VAULT.withQuests([quest])

  const result = service.completeResult(vault, quest.id)

  expect(result.completed).toBe(true)
  if (result.completed) {
    expect(result.event).toEqual({
      type: "quest_completed",
      questId: quest.id,
      reward: {
        gold: 100,
        exp: 50,
        affinityBonus: 0,
      },
    })
    expect(result.vault).not.toBe(vault)
    expect(Object.isFrozen(result.event.reward)).toBe(true)
  }
})

test("completeResult はゴールドと経験値を付与する", () => {
  const quest = createDefeatQuest(3)
  const vault = MOCK_VAULT.withQuests([quest])
  const initialGold = vault.player.gold
  const initialExp = vault.player.exp

  const result = service.completeResult(vault, quest.id).vault

  expect(result.player.gold).toBe(initialGold + 100)
  expect(result.player.exp).toBe(initialExp + 50)
})

test("completeResult はクエストを完了状態にする", () => {
  const quest = createDefeatQuest(3)
  const vault = MOCK_VAULT.withQuests([quest])

  const result = service.completeResult(vault, quest.id).vault

  const completedQuest = result.quests.find((q) => q.id === "defeat_quest")
  expect(completedQuest?.completed).toBe(true)
})

test("completeResult は gather タイプでアイテムを消費する", () => {
  const quest = createGatherQuest()
  const vaultWithQuest = MOCK_VAULT.withQuests([quest])
  const vaultWithItems = withMockInventory(vaultWithQuest, [
    { contentType: "item", contentId: "herb", quantity: 10 },
  ])

  const result = service.completeResult(vaultWithItems, quest.id).vault

  expect(result.inventory.totalQuantity("item", "herb")).toBe(5) // 10 - 5
})

test("completeResult は affinityBonus がある場合 NPC の affinity を増加させる", () => {
  const quest = createExploreQuest()
  const vaultWithQuest = withCompletableExploreQuest(quest)
  const initialNpc = vaultWithQuest.npcs.find((n) => n.id === "elda")
  const initialAffinity = initialNpc?.affinity ?? 0

  const completion = service.completeResult(vaultWithQuest, quest.id)

  expect(completion.completed).toBe(true)
  const updatedNpc = completion.vault.npcs.find((n) => n.id === "elda")
  expect(updatedNpc?.affinity).toBe(Math.min(100, initialAffinity + 10))
})

test("completeResult は affinity が 100 を超えない", () => {
  const quest: WizVaultQuestState = {
    ...createExploreQuest(),
    reward: { gold: 100, exp: 50, affinityBonus: 50 },
  }
  const vaultWithQuest = withCompletableExploreQuest(quest)
  // NPC の affinity を高く設定
  const vaultWithHighAffinity = vaultWithQuest.updateNpc("elda", (n) => ({
    ...n,
    affinity: 80,
  }))

  const completion = service.completeResult(vaultWithHighAffinity, quest.id)

  expect(completion.completed).toBe(true)
  const updatedNpc = completion.vault.npcs.find((n) => n.id === "elda")
  expect(updatedNpc?.affinity).toBe(100)
})

test("completeResult は注入したaffinity systemの上限を使う", () => {
  const boundedService = new WizEngineQuestProgress({
    affinitySystem: new WizConversationAffinitySystem({
      minimum: 10,
      maximum: 25,
      levels: [{ id: "bounded", minimum: 10 }],
    }),
    inventoryService,
  })
  const quest: WizVaultQuestState = {
    ...createExploreQuest(),
    reward: { gold: 100, exp: 50, affinityBonus: 50 },
  }
  const vault = withCompletableExploreQuest(quest).updateNpc("elda", (npc) => ({
    ...npc,
    affinity: 20,
  }))

  const completion = boundedService.completeResult(vault, quest.id)

  expect(completion.completed).toBe(true)
  expect(completion.vault.findNpc("elda")?.affinity).toBe(25)
})

test("completeResult は nextQuestId がある場合に QUEST_CHAIN_UNLOCKED ログを追加する", () => {
  const nextQuest: WizVaultQuestState = {
    id: "next_quest",
    name: "次のクエスト",
    description: "次の依頼",
    giverNpcId: "elda",
    objective: { type: "defeat", monsterId: "goblin", count: 5, current: 0 },
    reward: { gold: 200, exp: 100, affinityBonus: 0 },
    completed: false,
    accepted: false,
  }
  const quest: WizVaultQuestState = {
    ...createDefeatQuest(3),
    nextQuestId: "next_quest",
  }
  const vault = MOCK_VAULT.withQuests([quest, nextQuest])

  const result = service.completeResult(vault, quest.id).vault

  const chainLog = result.log.find((log) => log.key === "QUEST_CHAIN_UNLOCKED")
  expect(chainLog).toBeDefined()
})

test("completeResult は報酬アイテムがある場合にインベントリに追加する", () => {
  const quest: WizVaultQuestState = {
    ...createDefeatQuest(3),
    reward: {
      gold: 100,
      exp: 50,
      affinityBonus: 0,
      items: [
        { type: "item", itemId: "high_potion", quantity: 3 },
        { type: "item", itemId: "apple", quantity: 5 },
      ],
    },
  }
  const vault = MOCK_VAULT.withQuests([quest])

  const result = service.completeResult(vault, quest.id).vault

  expect(result.inventory.totalQuantity("item", "high_potion")).toBe(3)
  expect(result.inventory.totalQuantity("item", "apple")).toBe(5)
  const rewardLogs = result.log.filter((log) => log.key === "QUEST_REWARD_ITEM")
  expect(rewardLogs.length).toBe(2)
})

test("completeResult は discriminated reference の武器・防具報酬を正しい slot に追加する", () => {
  const quest: WizVaultQuestState = {
    ...createDefeatQuest(3),
    reward: {
      gold: 100,
      exp: 50,
      affinityBonus: 0,
      items: [
        { type: "weapon", weaponId: "short_sword", quantity: 2 },
        { type: "armor", armorId: "leather_armor", quantity: 1 },
      ],
    },
  }
  const vault = MOCK_VAULT.withQuests([quest])

  const result = service.completeResult(vault, quest.id).vault

  expect(result.inventory.totalQuantity("weapon", "short_sword")).toBe(2)
  expect(result.inventory.totalQuantity("armor", "leather_armor")).toBe(1)
})

const createDeliverQuest = (): WizVaultQuestState => ({
  id: "deliver_quest",
  name: "配達クエスト",
  description: "手紙をエルダに届けろ",
  giverNpcId: "elda",
  objective: {
    type: "deliver",
    itemId: "letter",
    npcId: "elda",
  },
  reward: { gold: 60, exp: 35, affinityBonus: 0 },
  completed: false,
  accepted: true,
})

test("canComplete は deliver タイプでアイテムがある場合 true を返す", () => {
  const quest = createDeliverQuest()
  const vault = withMockInventory(MOCK_VAULT.withQuests([quest]), [
    { contentType: "item", contentId: "letter" },
  ])

  const result = service.canComplete(vault, "deliver_quest")

  expect(result).toBe(true)
})

test("canComplete は deliver タイプでアイテムがない場合 false を返す", () => {
  const quest = createDeliverQuest()
  const vault = MOCK_VAULT.withQuests([quest])

  const result = service.canComplete(vault, "deliver_quest")

  expect(result).toBe(false)
})

test("completeResult は deliver タイプでアイテムを1個消費する", () => {
  const quest = createDeliverQuest()
  const vault = withMockInventory(MOCK_VAULT.withQuests([quest]), [
    { contentType: "item", contentId: "letter", quantity: 3 },
  ])

  const result = service.completeResult(vault, quest.id).vault

  expect(result.inventory.totalQuantity("item", "letter")).toBe(2)
})

test("completeResult は nextQuestId の先が既に受注済みの場合はログを追加しない", () => {
  const nextQuest: WizVaultQuestState = {
    id: "next_quest",
    name: "次のクエスト",
    description: "次の依頼",
    giverNpcId: "elda",
    objective: { type: "defeat", monsterId: "goblin", count: 5, current: 0 },
    reward: { gold: 200, exp: 100, affinityBonus: 0 },
    completed: false,
    accepted: true,
  }
  const quest: WizVaultQuestState = {
    ...createDefeatQuest(3),
    nextQuestId: "next_quest",
  }
  const vault = MOCK_VAULT.withQuests([quest, nextQuest])

  const result = service.completeResult(vault, quest.id).vault

  const chainLog = result.log.find((log) => log.key === "QUEST_CHAIN_UNLOCKED")
  expect(chainLog).toBeUndefined()
})
