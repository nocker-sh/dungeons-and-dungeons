import { expect, test } from "vite-plus/test"
import { WizEngineShopDialogueService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-dialogue-service"

const mockDialogues = [
  {
    shopId: "item_shop",
    shopkeeperName: "道具屋の主人",
    greeting: "いらっしゃい",
    products: {
      itemIds: ["potion"],
      weaponIds: [],
      armorIds: [],
    },
    topics: [
      {
        id: "rumor",
        label: "噂話",
        lines: [{ speaker: "shopkeeper" as const, text: "最近森で変な音がする" }],
      },
      {
        id: "secret",
        label: "秘密の話",
        condition: { minAffinity: 50 },
        lines: [{ speaker: "shopkeeper" as const, text: "実は隠し通路がある" }],
      },
      {
        id: "quest_hint",
        label: "クエストのヒント",
        condition: { flag: "quest_started" },
        lines: [{ speaker: "shopkeeper" as const, text: "洞窟の奥に宝がある" }],
      },
      {
        id: "combined",
        label: "特別な話",
        condition: { minAffinity: 30, flag: "special_flag" },
        lines: [{ speaker: "shopkeeper" as const, text: "特別な情報だ" }],
      },
      {
        id: "rec_beginner",
        label: "おすすめ (初心者)",
        condition: { maxLevel: 3 },
        lines: [{ speaker: "shopkeeper" as const, text: "傷薬がおすすめだ" }],
      },
      {
        id: "rec_mid",
        label: "おすすめ (中級)",
        condition: { minLevel: 4, maxLevel: 6 },
        lines: [{ speaker: "shopkeeper" as const, text: "高級傷薬がおすすめだ" }],
      },
      {
        id: "rec_advanced",
        label: "おすすめ (上級)",
        condition: { minLevel: 7 },
        lines: [{ speaker: "shopkeeper" as const, text: "万能薬がおすすめだ" }],
      },
    ],
  },
  {
    shopId: "weapon_shop",
    shopkeeperName: "武器屋の主人",
    greeting: "強い武器が揃ってるよ",
    products: {
      itemIds: [],
      weaponIds: ["sword"],
      armorIds: [],
    },
    topics: [],
  },
]

test("getDialogue は存在する shopId のダイアログを返す", () => {
  const service = new WizEngineShopDialogueService(mockDialogues)

  const result = service.getDialogue("item_shop")

  expect(result).not.toBeNull()
  expect(result?.shopId).toBe("item_shop")
  expect(result?.shopkeeperName).toBe("道具屋の主人")
})

test("getDialogue は存在しない shopId の場合 null を返す", () => {
  const service = new WizEngineShopDialogueService(mockDialogues)

  const result = service.getDialogue("nonexistent")

  expect(result).toBeNull()
})

test("parsed dialogueを所有し、返却値とtopic一覧をimmutableにする", () => {
  const input = [
    {
      shopId: "owned",
      shopkeeperName: "Before",
      greeting: "Hello",
      products: {
        itemIds: ["before"],
        weaponIds: [],
        armorIds: [],
      },
      topics: [
        {
          id: "topic",
          label: "Before",
          lines: [{ speaker: "shopkeeper", text: "Before" }],
        },
      ],
    },
  ]
  const ownedService = new WizEngineShopDialogueService(input)

  input[0]!.shopkeeperName = "After"
  input[0]!.products.itemIds[0] = "after"
  input[0]!.topics[0]!.label = "After"
  const dialogue = ownedService.getDialogue("owned")
  if (!dialogue) throw new Error("owned dialogue is required")
  const topics = ownedService.getAvailableTopics(dialogue, 0, [])

  expect(dialogue.shopkeeperName).toBe("Before")
  expect(dialogue.products.itemIds).toEqual(["before"])
  expect(dialogue.topics[0]?.label).toBe("Before")
  expect(Object.isFrozen(dialogue)).toBe(true)
  expect(Object.isFrozen(dialogue.products)).toBe(true)
  expect(Object.isFrozen(dialogue.products.itemIds)).toBe(true)
  expect(Object.isFrozen(dialogue.topics)).toBe(true)
  expect(Object.isFrozen(topics)).toBe(true)
})

test("dialogue registryを外部から変更できずprototype名のshopIdもown lookupする", () => {
  const service = new WizEngineShopDialogueService([
    {
      shopId: "toString",
      shopkeeperName: "Prototype Keeper",
      greeting: "Safe lookup",
      products: {
        itemIds: [],
        weaponIds: [],
        armorIds: [],
      },
      topics: [],
    },
  ])
  const internalRegistryView = service as unknown as {
    dialogues: Map<string, unknown>
  }

  expect(Reflect.ownKeys(service)).not.toContain("dialogues")
  expect(() => internalRegistryView.dialogues.clear()).toThrow(TypeError)
  expect(service.getDialogue("toString")).toMatchObject({
    shopId: "toString",
    shopkeeperName: "Prototype Keeper",
  })
  expect(service.getDialogue("valueOf")).toBeNull()
})

test("getAvailableTopics は条件なしの topic を常に含める", () => {
  const service = new WizEngineShopDialogueService(mockDialogues)
  const dialogue = service.getDialogue("item_shop")
  if (!dialogue) throw new Error("dialogue not found")

  const result = service.getAvailableTopics(dialogue, 0, [])

  const rumorTopic = result.find((t) => t.id === "rumor")
  expect(rumorTopic).toBeDefined()
})

test("getAvailableTopics は minAffinity が足りない topic を除外する", () => {
  const service = new WizEngineShopDialogueService(mockDialogues)
  const dialogue = service.getDialogue("item_shop")
  if (!dialogue) throw new Error("dialogue not found")

  const result = service.getAvailableTopics(dialogue, 30, [])

  const secretTopic = result.find((t) => t.id === "secret")
  expect(secretTopic).toBeUndefined()
})

test("getAvailableTopics は minAffinity を満たす topic を含める", () => {
  const service = new WizEngineShopDialogueService(mockDialogues)
  const dialogue = service.getDialogue("item_shop")
  if (!dialogue) throw new Error("dialogue not found")

  const result = service.getAvailableTopics(dialogue, 50, [])

  const secretTopic = result.find((t) => t.id === "secret")
  expect(secretTopic).toBeDefined()
})

test("getAvailableTopics は flag がない topic を除外する", () => {
  const service = new WizEngineShopDialogueService(mockDialogues)
  const dialogue = service.getDialogue("item_shop")
  if (!dialogue) throw new Error("dialogue not found")

  const result = service.getAvailableTopics(dialogue, 100, [])

  const questHintTopic = result.find((t) => t.id === "quest_hint")
  expect(questHintTopic).toBeUndefined()
})

test("getAvailableTopics は flag を持つ topic を含める", () => {
  const service = new WizEngineShopDialogueService(mockDialogues)
  const dialogue = service.getDialogue("item_shop")
  if (!dialogue) throw new Error("dialogue not found")

  const result = service.getAvailableTopics(dialogue, 0, ["quest_started"])

  const questHintTopic = result.find((t) => t.id === "quest_hint")
  expect(questHintTopic).toBeDefined()
})

test("getAvailableTopics は minAffinity と flag 両方の条件を評価する", () => {
  const service = new WizEngineShopDialogueService(mockDialogues)
  const dialogue = service.getDialogue("item_shop")
  if (!dialogue) throw new Error("dialogue not found")

  // affinity が足りない
  const result1 = service.getAvailableTopics(dialogue, 20, ["special_flag"])
  expect(result1.find((t) => t.id === "combined")).toBeUndefined()

  // flag がない
  const result2 = service.getAvailableTopics(dialogue, 50, [])
  expect(result2.find((t) => t.id === "combined")).toBeUndefined()

  // 両方満たす
  const result3 = service.getAvailableTopics(dialogue, 50, ["special_flag"])
  expect(result3.find((t) => t.id === "combined")).toBeDefined()
})

test("getAvailableTopics は maxLevel を超えた topic を除外する", () => {
  const service = new WizEngineShopDialogueService(mockDialogues)
  const dialogue = service.getDialogue("item_shop")
  if (!dialogue) throw new Error("dialogue not found")

  const result = service.getAvailableTopics(dialogue, 0, [], 5)

  expect(result.find((t) => t.id === "rec_beginner")).toBeUndefined()
  expect(result.find((t) => t.id === "rec_mid")).toBeDefined()
  expect(result.find((t) => t.id === "rec_advanced")).toBeUndefined()
})

test("getAvailableTopics は minLevel を満たさない topic を除外する", () => {
  const service = new WizEngineShopDialogueService(mockDialogues)
  const dialogue = service.getDialogue("item_shop")
  if (!dialogue) throw new Error("dialogue not found")

  const result = service.getAvailableTopics(dialogue, 0, [], 2)

  expect(result.find((t) => t.id === "rec_beginner")).toBeDefined()
  expect(result.find((t) => t.id === "rec_mid")).toBeUndefined()
  expect(result.find((t) => t.id === "rec_advanced")).toBeUndefined()
})

test("getAvailableTopics は minLevel 7 以上で上級トピックを表示する", () => {
  const service = new WizEngineShopDialogueService(mockDialogues)
  const dialogue = service.getDialogue("item_shop")
  if (!dialogue) throw new Error("dialogue not found")

  const result = service.getAvailableTopics(dialogue, 0, [], 10)

  expect(result.find((t) => t.id === "rec_beginner")).toBeUndefined()
  expect(result.find((t) => t.id === "rec_mid")).toBeUndefined()
  expect(result.find((t) => t.id === "rec_advanced")).toBeDefined()
})
