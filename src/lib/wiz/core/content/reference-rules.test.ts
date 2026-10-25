import { describe, expect, it } from "vite-plus/test"
import {
  type WorldContentDiagnostic,
  WorldContentValidationError,
} from "@/lib/wiz/core/content/diagnostic"
import { WorldContent } from "@/lib/wiz/core/content/world-content"

const diagnosticsFrom = (input: unknown): readonly WorldContentDiagnostic[] => {
  try {
    WorldContent.parse(input)
  } catch (error) {
    if (error instanceof WorldContentValidationError) {
      return error.diagnostics
    }
    throw error
  }
  throw new Error("Expected WorldContent validation to fail")
}

const GUIDE_NPC = {
  id: "guide",
  name: "Guide",
  occupation: "Guide",
  personality: "Calm",
  initialAffinity: 0,
  likes: [],
  dislikes: [],
  dialogues: [],
} as const

const SLIME_MONSTER = {
  id: "slime",
  name: "Slime",
  hp: 10,
  attack: 2,
  defense: 1,
  agility: 1,
  expReward: 1,
  goldReward: 0,
  drops: [],
} as const

const areaDefinition = (id: string, requiredAreaId?: string) => ({
  id,
  name: id,
  description: id,
  dangerLevel: 0,
  apCost: 0,
  unlocked: requiredAreaId === undefined,
  ...(requiredAreaId === undefined
    ? {}
    : { unlockCondition: { areaId: requiredAreaId, requiredProgress: 1 } }),
  availableGathering: [],
  monsterIds: [],
  eventIds: [],
})

const questDefinition = (id: string, nextQuestId?: string) => ({
  id,
  name: id,
  description: id,
  giverNpcId: "guide",
  objective: { type: "defeat" as const, monsterId: "slime", count: 1 },
  reward: { gold: 0, exp: 0, affinityBonus: 0 },
  ...(nextQuestId === undefined ? {} : { nextQuestId }),
})

describe("WorldContent semantic ID validation", () => {
  it("空または空白だけの宣言 ID / 参照 ID を missing にせず path 付きで集約する", () => {
    const diagnostics = diagnosticsFrom({
      items: [
        {
          id: "",
          name: "Invalid item",
          description: "Invalid item",
          itemType: "material",
          price: 0,
          sellPrice: 0,
        },
      ],
      areas: [
        {
          ...areaDefinition("field"),
          availableGathering: ["   "],
        },
      ],
      npcs: [
        {
          ...GUIDE_NPC,
          dialogues: [
            {
              id: " ",
              minAffinity: 0,
              lines: [{ speaker: "Guide", text: "Choose." }],
              options: [
                {
                  id: "",
                  text: "Ask",
                  responseDialogueId: "\t",
                },
              ],
            },
          ],
        },
      ],
      shopDialogues: [
        {
          shopId: "shop",
          shopkeeperName: "Keeper",
          greeting: "Welcome",
          products: {
            itemIds: [],
            weaponIds: [],
            armorIds: [],
          },
          topics: [
            {
              id: "\n",
              label: "Topic",
              condition: { hasItem: "" },
              lines: [{ speaker: "shopkeeper", text: "Info" }],
            },
          ],
        },
      ],
      innPlans: [{ id: " ", price: 0 }],
    })

    expect(diagnostics.filter((diagnostic) => diagnostic.code === "invalid_id")).toHaveLength(5)
    expect(
      diagnostics.filter((diagnostic) => diagnostic.code === "invalid_reference_id"),
    ).toHaveLength(3)
    expect(diagnostics.some((diagnostic) => diagnostic.code === "missing_reference")).toBe(false)
    expect(diagnostics.map((diagnostic) => diagnostic.path)).toEqual(
      expect.arrayContaining([
        "items[0].id",
        "areas[0].availableGathering[0]",
        "npcs[0].dialogues[0].id",
        "npcs[0].dialogues[0].options[0].id",
        "npcs[0].dialogues[0].options[0].responseDialogueId",
        "shopDialogues[0].topics[0].id",
        "shopDialogues[0].topics[0].condition.hasItem",
        "innPlans[0].id",
      ]),
    )
    expect(Object.isFrozen(diagnostics)).toBe(true)
    expect(diagnostics.every(Object.isFrozen)).toBe(true)
  })

  it("宿泊プランIDの重複をcontent全体の診断として拒否する", () => {
    const diagnostics = diagnosticsFrom({
      innPlans: [
        { id: "rest", price: 10 },
        { id: "rest", price: 20 },
      ],
    })

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "duplicate_id",
        kind: "inn_plan",
        id: "rest",
        firstPath: "innPlans[0].id",
        path: "innPlans[1].id",
      }),
    ])
  })

  it("NPC dialogue / option と shop topic の局所重複を各 scope で拒否する", () => {
    const diagnostics = diagnosticsFrom({
      npcs: [
        {
          ...GUIDE_NPC,
          dialogues: [
            { id: "greeting", minAffinity: 0, lines: ["Hello"] },
            { id: "greeting", minAffinity: 1, lines: ["Again"] },
            {
              id: "questions",
              minAffinity: 0,
              lines: [{ speaker: "Guide", text: "Ask." }],
              options: [
                { id: "ask", text: "First" },
                { id: "ask", text: "Second" },
              ],
            },
          ],
        },
      ],
      shopDialogues: [
        {
          shopId: "shop",
          shopkeeperName: "Keeper",
          greeting: "Welcome",
          products: {
            itemIds: [],
            weaponIds: [],
            armorIds: [],
          },
          topics: [
            {
              id: "rumor",
              label: "First rumor",
              lines: [{ speaker: "shopkeeper", text: "One" }],
            },
            {
              id: "rumor",
              label: "Second rumor",
              lines: [{ speaker: "shopkeeper", text: "Two" }],
            },
          ],
        },
      ],
    })

    expect(diagnostics).toHaveLength(3)
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "duplicate_id",
        kind: "npc",
        idKind: "npc_dialogue",
        path: "npcs[0].dialogues[1].id",
        firstPath: "npcs[0].dialogues[0].id",
      }),
      expect.objectContaining({
        code: "duplicate_id",
        kind: "npc",
        idKind: "npc_dialogue_option",
        path: "npcs[0].dialogues[2].options[1].id",
        firstPath: "npcs[0].dialogues[2].options[0].id",
      }),
      expect.objectContaining({
        code: "duplicate_id",
        kind: "shop_dialogue",
        idKind: "shop_topic",
        path: "shopDialogues[0].topics[1].id",
        firstPath: "shopDialogues[0].topics[0].id",
      }),
    ])
  })

  it("局所 ID は異なる親 scope 間で再利用できる", () => {
    expect(() =>
      WorldContent.parse({
        npcs: [
          {
            ...GUIDE_NPC,
            dialogues: [
              {
                id: "first",
                minAffinity: 0,
                lines: [{ speaker: "Guide", text: "First." }],
                options: [{ id: "ask", text: "Ask" }],
              },
              {
                id: "second",
                minAffinity: 0,
                lines: [{ speaker: "Guide", text: "Second." }],
                options: [{ id: "ask", text: "Ask again" }],
              },
            ],
          },
        ],
        shopDialogues: [
          {
            shopId: "first_shop",
            shopkeeperName: "First",
            greeting: "Welcome",
            products: {
              itemIds: [],
              weaponIds: [],
              armorIds: [],
            },
            topics: [
              {
                id: "rumor",
                label: "Rumor",
                lines: [{ speaker: "shopkeeper", text: "One" }],
              },
            ],
          },
          {
            shopId: "second_shop",
            shopkeeperName: "Second",
            greeting: "Welcome",
            products: {
              itemIds: [],
              weaponIds: [],
              armorIds: [],
            },
            topics: [
              {
                id: "rumor",
                label: "Rumor",
                lines: [{ speaker: "shopkeeper", text: "Two" }],
              },
            ],
          },
        ],
      }),
    ).not.toThrow()
  })
})

describe("WorldContent reference graph validation", () => {
  it("同じshop・category内の商品ID重複を正確なpath付きで拒否する", () => {
    const diagnostics = diagnosticsFrom({
      items: [
        {
          id: "potion",
          name: "Potion",
          description: "Restores health",
          itemType: "consumable",
          price: 10,
          sellPrice: 5,
        },
      ],
      weapons: [
        {
          id: "sword",
          name: "Sword",
          description: "A sword",
          attack: 1,
          dexterityBonus: 0,
          slotId: "mainHand",
          price: 10,
          sellPrice: 5,
        },
      ],
      armors: [
        {
          id: "mail",
          name: "Mail",
          description: "An armor",
          defense: 1,
          agilityPenalty: 0,
          slotId: "body",
          price: 10,
          sellPrice: 5,
        },
      ],
      shopDialogues: [
        {
          shopId: "shop",
          shopkeeperName: "Keeper",
          greeting: "Welcome",
          products: {
            itemIds: ["potion", "potion"],
            weaponIds: ["sword", "sword"],
            armorIds: ["mail", "mail"],
          },
          topics: [],
        },
      ],
    })

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "duplicate_id",
        kind: "shop_dialogue",
        idKind: "shop_product",
        id: "potion",
        path: "shopDialogues[0].products.itemIds[1]",
        firstPath: "shopDialogues[0].products.itemIds[0]",
      }),
      expect.objectContaining({
        code: "duplicate_id",
        kind: "shop_dialogue",
        idKind: "shop_product",
        id: "sword",
        path: "shopDialogues[0].products.weaponIds[1]",
        firstPath: "shopDialogues[0].products.weaponIds[0]",
      }),
      expect.objectContaining({
        code: "duplicate_id",
        kind: "shop_dialogue",
        idKind: "shop_product",
        id: "mail",
        path: "shopDialogues[0].products.armorIds[1]",
        firstPath: "shopDialogues[0].products.armorIds[0]",
      }),
    ])
  })

  it("shopの商品IDをcategory別に検証し、全pathを集約する", () => {
    const diagnostics = diagnosticsFrom({
      items: [
        {
          id: "potion",
          name: "Potion",
          description: "Restores health",
          itemType: "consumable",
          price: 10,
          sellPrice: 5,
        },
      ],
      weapons: [
        {
          id: "sword",
          name: "Sword",
          description: "A sword",
          attack: 1,
          dexterityBonus: 0,
          slotId: "mainHand",
          price: 10,
          sellPrice: 5,
        },
      ],
      armors: [
        {
          id: "mail",
          name: "Mail",
          description: "An armor",
          defense: 1,
          agilityPenalty: 0,
          slotId: "body",
          price: 10,
          sellPrice: 5,
        },
      ],
      shopDialogues: [
        {
          shopId: "shop",
          shopkeeperName: "Keeper",
          greeting: "Welcome",
          products: {
            itemIds: ["missing_item", "sword"],
            weaponIds: ["missing_weapon", "mail"],
            armorIds: ["missing_armor", "potion"],
          },
          topics: [],
        },
      ],
    })

    expect(diagnostics).toHaveLength(6)
    expect(diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      "shopDialogues[0].products.itemIds[0]",
      "shopDialogues[0].products.itemIds[1]",
      "shopDialogues[0].products.weaponIds[0]",
      "shopDialogues[0].products.weaponIds[1]",
      "shopDialogues[0].products.armorIds[0]",
      "shopDialogues[0].products.armorIds[1]",
    ])
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "missing_reference",
        kind: "shop_dialogue",
        referenceId: "missing_item",
        expectedKind: "item",
      }),
      expect.objectContaining({
        code: "wrong_reference_kind",
        kind: "shop_dialogue",
        referenceId: "sword",
        expectedKind: "item",
        actualKinds: ["weapon"],
      }),
      expect.objectContaining({
        code: "missing_reference",
        kind: "shop_dialogue",
        referenceId: "missing_weapon",
        expectedKind: "weapon",
      }),
      expect.objectContaining({
        code: "wrong_reference_kind",
        kind: "shop_dialogue",
        referenceId: "mail",
        expectedKind: "weapon",
        actualKinds: ["armor"],
      }),
      expect.objectContaining({
        code: "missing_reference",
        kind: "shop_dialogue",
        referenceId: "missing_armor",
        expectedKind: "armor",
      }),
      expect.objectContaining({
        code: "wrong_reference_kind",
        kind: "shop_dialogue",
        referenceId: "potion",
        expectedKind: "armor",
        actualKinds: ["item"],
      }),
    ])
  })

  it("area unlock と quest next の自己参照を集約して拒否する", () => {
    const diagnostics = diagnosticsFrom({
      areas: [areaDefinition("field", "field")],
      npcs: [GUIDE_NPC],
      monsters: [SLIME_MONSTER],
      quests: [questDefinition("first", "first")],
    })

    expect(diagnostics).toHaveLength(2)
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "cyclic_reference",
        kind: "area",
        path: "areas[0].unlockCondition.areaId",
        cycle: ["field", "field"],
      }),
      expect.objectContaining({
        code: "cyclic_reference",
        kind: "quest",
        path: "quests[0].nextQuestId",
        cycle: ["first", "first"],
      }),
    ])
    for (const diagnostic of diagnostics) {
      if (diagnostic.code !== "cyclic_reference") continue
      expect(Object.isFrozen(diagnostic.cycle)).toBe(true)
    }
  })

  it("複数 node の循環に含まれる全 edge を宣言 path 付きで報告する", () => {
    const diagnostics = diagnosticsFrom({
      areas: [areaDefinition("forest", "cave"), areaDefinition("cave", "forest")],
      npcs: [GUIDE_NPC],
      monsters: [SLIME_MONSTER],
      quests: [questDefinition("first", "second"), questDefinition("second", "first")],
    })

    expect(diagnostics).toHaveLength(4)
    expect(diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      "areas[0].unlockCondition.areaId",
      "areas[1].unlockCondition.areaId",
      "quests[0].nextQuestId",
      "quests[1].nextQuestId",
    ])
    expect(diagnostics.every((diagnostic) => diagnostic.code === "cyclic_reference")).toBe(true)
  })

  it("循環しない area / quest の依存 DAG は許可する", () => {
    const content = WorldContent.parse({
      areas: [
        areaDefinition("field"),
        areaDefinition("forest", "field"),
        areaDefinition("cave", "forest"),
      ],
      npcs: [GUIDE_NPC],
      monsters: [SLIME_MONSTER],
      quests: [
        questDefinition("first", "second"),
        questDefinition("second", "third"),
        questDefinition("third"),
      ],
    })

    expect(content.getArea("cave")?.unlockCondition?.areaId).toBe("forest")
    expect(content.getQuest("first")?.nextQuestId).toBe("second")
  })
})
