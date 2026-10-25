import { expect, test } from "vite-plus/test"
import { WizVaultQuestStateFactory } from "@/lib/wiz/core/vault/factory/quest-state-factory"

import type { WizContentQuest } from "@/lib/wiz/core/definition/quest/quest"

const mockQuests: WizContentQuest[] = [
  {
    id: "defeat_slimes",
    name: "Slime Hunt",
    description: "Defeat 5 slimes",
    giverNpcId: "elder",
    objective: { type: "defeat", monsterId: "slime", count: 5 },
    reward: {
      gold: 100,
      exp: 50,
      affinityBonus: 10,
      items: [{ type: "item", itemId: "potion", quantity: 1 }],
    },
  },
  {
    id: "gather_herbs",
    name: "Herb Collection",
    description: "Gather 10 herbs",
    giverNpcId: "merchant",
    objective: { type: "gather", itemId: "herb", count: 10 },
    reward: { gold: 50, exp: 20, affinityBonus: 5 },
  },
  {
    id: "explore_cave",
    name: "Cave Exploration",
    description: "Explore the cave",
    giverNpcId: "elder",
    objective: { type: "explore", areaId: "cave", requiredProgress: 50 },
    reward: { gold: 200, exp: 100, affinityBonus: 20 },
  },
  {
    id: "deliver_letter",
    name: "Deliver Letter",
    description: "Deliver a letter",
    giverNpcId: "elder",
    objective: { type: "deliver", itemId: "letter", npcId: "merchant" },
    reward: { gold: 30, exp: 10, affinityBonus: 15 },
  },
]

test("getAll はクエスト一覧を返す", () => {
  const factory = new WizVaultQuestStateFactory({ defs: mockQuests })

  const quests = factory.getAll()

  expect(quests).toHaveLength(4)
})

test("クエストは completed: false, accepted: false で初期化される", () => {
  const factory = new WizVaultQuestStateFactory({ defs: mockQuests })

  const quests = factory.getAll()

  for (const quest of quests) {
    expect(quest.completed).toBe(false)
    expect(quest.accepted).toBe(false)
  }
})

test("defeat タイプのクエストは current: 0 で初期化される", () => {
  const factory = new WizVaultQuestStateFactory({ defs: mockQuests })

  const quests = factory.getAll()
  const defeatQuest = quests.find((q) => q.id === "defeat_slimes")

  expect(defeatQuest?.objective.type).toBe("defeat")
  if (defeatQuest?.objective.type === "defeat") {
    expect(defeatQuest.objective.current).toBe(0)
    expect(defeatQuest.objective.count).toBe(5)
  }
})

test("gather タイプのクエストは current: 0 で初期化される", () => {
  const factory = new WizVaultQuestStateFactory({ defs: mockQuests })

  const quests = factory.getAll()
  const gatherQuest = quests.find((q) => q.id === "gather_herbs")

  expect(gatherQuest?.objective.type).toBe("gather")
  if (gatherQuest?.objective.type === "gather") {
    expect(gatherQuest.objective.current).toBe(0)
  }
})

test("explore タイプのクエストは requiredProgress を持つ", () => {
  const factory = new WizVaultQuestStateFactory({ defs: mockQuests })

  const quests = factory.getAll()
  const exploreQuest = quests.find((q) => q.id === "explore_cave")

  expect(exploreQuest?.objective.type).toBe("explore")
  if (exploreQuest?.objective.type === "explore") {
    expect(exploreQuest.objective.requiredProgress).toBe(50)
  }
})

test("deliver タイプのクエストは itemId と npcId を持つ", () => {
  const factory = new WizVaultQuestStateFactory({ defs: mockQuests })

  const quests = factory.getAll()
  const deliverQuest = quests.find((q) => q.id === "deliver_letter")

  expect(deliverQuest?.objective.type).toBe("deliver")
  if (deliverQuest?.objective.type === "deliver") {
    expect(deliverQuest.objective.itemId).toBe("letter")
    expect(deliverQuest.objective.npcId).toBe("merchant")
  }
})

test("reward が正しく設定される", () => {
  const factory = new WizVaultQuestStateFactory({ defs: mockQuests })

  const quests = factory.getAll()
  const quest = quests[0]

  expect(quest.reward.gold).toBe(100)
  expect(quest.reward.exp).toBe(50)
  expect(quest.reward.affinityBonus).toBe(10)
  expect(quest.reward.items).toEqual([{ type: "item", itemId: "potion", quantity: 1 }])
})

test("source と getter から変更できない deep readonly owned graph を返す", () => {
  const defs = [
    {
      id: "defeat_slimes",
      name: "Slime Hunt",
      description: "Defeat 5 slimes",
      giverNpcId: "elder",
      objective: { type: "defeat", monsterId: "slime", count: 5 },
      reward: {
        gold: 100,
        exp: 50,
        affinityBonus: 10,
        items: [{ type: "item", itemId: "potion", quantity: 1 }],
      },
    },
  ]
  const factory = new WizVaultQuestStateFactory({ defs })

  defs[0].name = "Changed"
  defs[0].objective.count = 99
  defs[0].reward.items[0].quantity = 9

  const quests = factory.getAll()
  const quest = quests[0]
  const rewardItem = quest.reward.items?.[0]
  if (quest.objective.type !== "defeat" || !rewardItem) {
    throw new Error("Expected defeat quest reward")
  }

  expect(Object.isFrozen(quests)).toBe(true)
  expect(Object.isFrozen(quest)).toBe(true)
  expect(Object.isFrozen(quest.objective)).toBe(true)
  expect(Object.isFrozen(quest.reward)).toBe(true)
  expect(Object.isFrozen(quest.reward.items)).toBe(true)
  expect(Object.isFrozen(rewardItem)).toBe(true)
  expect(quest.name).toBe("Slime Hunt")
  expect(quest.objective.count).toBe(5)
  expect(rewardItem.quantity).toBe(1)

  expect(Reflect.set(quest, "name", "Changed through getter")).toBe(false)
  expect(Reflect.set(quest.objective, "count", 99)).toBe(false)
  expect(Reflect.set(rewardItem, "quantity", 9)).toBe(false)
  expect(Reflect.set(quests, 0, undefined)).toBe(false)

  const nextQuest = factory.getAll()[0]
  expect(nextQuest.name).toBe("Slime Hunt")
  expect(nextQuest.objective.type).toBe("defeat")
  if (nextQuest.objective.type === "defeat") {
    expect(nextQuest.objective.count).toBe(5)
  }
  expect(nextQuest.reward.items?.[0].quantity).toBe(1)
})
