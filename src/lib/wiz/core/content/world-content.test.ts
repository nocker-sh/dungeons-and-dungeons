import { z } from "zod"
import { describe, expect, it } from "vite-plus/test"
import { zWizContentItem } from "@/lib/wiz/core/definition/item/item"
import { WorldContentValidationError } from "@/lib/wiz/core/content/diagnostic"
import {
  WORLD_SNAPSHOT_ORPHAN_POLICIES,
  WorldSnapshotReconcileError,
} from "@/lib/wiz/core/content/reconcile-snapshot"
import { zWorldContentArrays } from "@/lib/wiz/core/content/schema"
import {
  diagnoseWorldSnapshot,
  WorldSnapshotValidationError,
} from "@/lib/wiz/core/content/snapshot-rules"
import {
  createWizStandardBattleContent,
  createWizStandardShopDialogueService,
  createWizStandardAbilityLearning,
  createWizStandardVault,
} from "@/lib/wiz/core/presets/standard-content-adapter"
import { WIZ_IMMUTABLE_VALUE, WizImmutableValue } from "@/lib/wiz/core/immutable-value"
import { WorldContent } from "@/lib/wiz/core/content/world-content"
import { WorldSnapshot } from "@/lib/wiz/core/save/world-snapshot"
import type { WizStandardSchemaDefinition } from "@/lib/wiz/core/standard-schema"

const VALID_CONTENT_INPUT = {
  items: [
    {
      id: "herb",
      name: "Herb",
      description: "A useful herb",
      itemType: "material",
      price: 5,
      sellPrice: 2,
    },
    {
      id: "potion",
      name: "Potion",
      description: "Restores health",
      itemType: "consumable",
      price: 20,
      sellPrice: 10,
      effect: { type: "heal", value: 20 },
    },
  ],
  weapons: [
    {
      id: "sword",
      name: "Sword",
      description: "A sword",
      attack: 5,
      dexterityBonus: 0,
      slotId: "mainHand",
      price: 50,
      sellPrice: 25,
    },
  ],
  armors: [
    {
      id: "mail",
      name: "Mail",
      description: "A mail armor",
      defense: 4,
      agilityPenalty: 1,
      slotId: "body",
      price: 60,
      sellPrice: 30,
    },
  ],
  recipes: [
    {
      id: "potion_recipe",
      name: "Potion recipe",
      description: "Brew a potion",
      materials: [{ type: "item", itemId: "herb", quantity: 2 }],
      result: { type: "item", itemId: "potion" },
      difficulty: 1,
      requiresFacility: "alchemy",
    },
  ],
  monsters: [
    {
      id: "slime",
      name: "Slime",
      hp: 10,
      attack: 2,
      defense: 1,
      agility: 1,
      expReward: 3,
      goldReward: 1,
      drops: [{ itemId: "herb", chance: 0.5 }],
    },
  ],
  events: [
    {
      id: "find_herb",
      description: "You find an herb",
      choices: [
        {
          label: "Take it",
          successText: "Taken",
          failText: "Lost",
          successReward: { items: [{ itemId: "herb", quantity: 1 }] },
        },
      ],
    },
  ],
  areas: [
    {
      id: "field",
      name: "Field",
      description: "An open field",
      dangerLevel: 1,
      apCost: 1,
      unlocked: true,
      availableGathering: ["herb"],
      monsterIds: ["slime"],
      eventIds: ["find_herb"],
    },
  ],
  npcs: [
    {
      id: "sage",
      name: "Sage",
      occupation: "Sage",
      personality: "Calm",
      initialAffinity: 0,
      likes: ["herb"],
      dislikes: [],
      dialogues: [
        {
          id: "greeting",
          minAffinity: 0,
          lines: ["Hello"],
          afterQuest: "first_quest",
        },
      ],
    },
  ],
  quests: [
    {
      id: "first_quest",
      name: "First quest",
      description: "Defeat a slime",
      giverNpcId: "sage",
      objective: { type: "defeat", monsterId: "slime", count: 1 },
      reward: {
        gold: 5,
        exp: 10,
        affinityBonus: 1,
        items: [{ type: "item", itemId: "potion", quantity: 1 }],
      },
    },
  ],
  facilities: [
    {
      facilityId: "alchemy",
      type: "area_progress",
      areaId: "field",
      requiredProgress: 10,
    },
  ],
  abilities: [
    {
      id: "fire",
      name: "Fire",
      description: "Fire damage",
      tags: [],
      costs: { mana: 3 },
      effect: { type: "damage", side: "opponents", target: "single", element: "fire", power: 10 },
      custom: {},
    },
    {
      id: "heal",
      name: "Heal",
      description: "Restore health",
      tags: [],
      costs: { mana: 3 },
      effect: { type: "heal", side: "allies", target: "single", element: "none", power: 10 },
      custom: {},
    },
    {
      id: "powerStrike",
      name: "Power Strike",
      description: "Heavy damage",
      tags: [],
      costs: { mana: 2 },
      effect: {
        type: "damage",
        side: "opponents",
        target: "single",
        element: "physical",
        power: 12,
      },
      custom: {},
    },
  ],
  shopDialogues: [
    {
      shopId: "village_shop",
      shopkeeperName: "Shopkeeper",
      greeting: "Welcome",
      products: {
        itemIds: ["herb", "potion"],
        weaponIds: ["sword"],
        armorIds: ["mail"],
      },
      topics: [
        {
          id: "herb",
          label: "Herbs",
          condition: { hasItem: "herb" },
          lines: [{ speaker: "shopkeeper", text: "Fresh herbs." }],
        },
      ],
    },
  ],
  abilityTable: [{ abilityId: "fire", requiredLevel: 2 }],
  innPlans: [
    {
      id: "moon-rest",
      price: 25,
      hpRecovery: { fixed: 10, percent: 25 },
      mpRecovery: { percent: 50 },
      hungerRecovery: 15,
      apRecovery: "full",
    },
  ],
} as const

const createSnapshotWithOrphanedReferences = () => {
  const content = WorldContent.create(VALID_CONTENT_INPUT)
  const initial = content.createInitialSnapshot().toPlain()
  const snapshot = WorldSnapshot.create({
    ...initial,
    player: {
      ...initial.player,
      abilityIds: ["fire", "retired_skill", "heal"],
    },
    partyMembers: [
      {
        id: "guest",
        name: "Guest",
        classId: "warrior",
        level: 1,
        hp: 10,
        maxHp: 10,
        mp: 5,
        maxMp: 5,
        attributes: {
          strength: 5,
          dexterity: 5,
          agility: 5,
          vitality: 5,
          wisdom: 5,
          charisma: 5,
        },
        abilityIds: ["powerStrike", "retired_skill"],
      },
    ],
    inventory: {
      capacity: 20,
      entries: [
        { entryId: "herb-stack", contentType: "item", contentId: "herb", quantity: 3 },
        {
          entryId: "retired-item-stack",
          contentType: "item",
          contentId: "retired_item",
          quantity: 7,
        },
        { entryId: "potion-stack", contentType: "item", contentId: "potion", quantity: 2 },
        { entryId: "sword-1", contentType: "weapon", contentId: "sword", quantity: 1 },
        {
          entryId: "retired-sword-1",
          contentType: "weapon",
          contentId: "retired_sword",
          quantity: 1,
        },
        { entryId: "sword-2", contentType: "weapon", contentId: "sword", quantity: 1 },
        { entryId: "mail-1", contentType: "armor", contentId: "mail", quantity: 1 },
        {
          entryId: "retired-armor-1",
          contentType: "armor",
          contentId: "retired_armor",
          quantity: 1,
        },
      ],
    },
    equipment: {
      mainHand: "retired-sword-1",
      body: "retired-armor-1",
    },
    unlockedFacilities: ["alchemy", "retired_facility"],
  })
  return { content, snapshot }
}

describe("WorldContent", () => {
  it("内部validation helperを公開せずconstructorのruntime迂回を拒否する", () => {
    expect(Object.hasOwn(WorldContent, "fromValidatedArrays")).toBe(false)
    expect(() => Reflect.construct(WorldContent, [VALID_CONTENT_INPUT])).toThrow(TypeError)
  })

  it("literal ID を保持して immutable content を作る", () => {
    const content = WorldContent.create(VALID_CONTENT_INPUT)

    const herbName: string = content.getItem("herb").name
    const swordAttack: number = content.getWeapon("sword").attack
    const typedSnapshot = content.createInitialSnapshot({
      equipment: {
        mainHand: "sword-entry",
        body: "mail-entry",
      },
      inventory: {
        capacity: 3,
        entries: [
          {
            entryId: "herb-stack",
            contentType: "item",
            contentId: "herb",
            quantity: 1,
          },
          {
            entryId: "sword-entry",
            contentType: "weapon",
            contentId: "sword",
            quantity: 1,
          },
          {
            entryId: "mail-entry",
            contentType: "armor",
            contentId: "mail",
            quantity: 1,
          },
        ],
      },
      unlockedFacilities: ["alchemy"],
    })
    const snapshotItemId: "herb" | "potion" = typedSnapshot.inventory.entries.find(
      (entry) => entry.contentType === "item",
    )!.contentId

    expect(herbName).toBe("Herb")
    expect(swordAttack).toBe(5)
    expect(snapshotItemId).toBe("herb")
    const firstShopItemId: "herb" = content.shopDialogues[0].products.itemIds[0]
    const verifyReadonlyDefinitions = () => {
      // @ts-expect-error content arrayはreadonly
      content.arrays.items.push(VALID_CONTENT_INPUT.items[0])
      // @ts-expect-error ID recordのentryもdeep readonly
      content.items.herb.potency = 99
      // @ts-expect-error nested product ID arrayもreadonly
      content.shopDialogues[0].products.itemIds.push("herb")
    }
    const verifySnapshotReferences = () => {
      content.createInitialSnapshot({
        inventory: {
          capacity: 1,
          entries: [
            {
              entryId: "missing-item-entry",
              contentType: "item",
              // @ts-expect-error contentに存在しないitem ID
              contentId: "missing-item",
              quantity: 1,
            },
          ],
        },
        // @ts-expect-error contentに存在しないfacility ID
        unlockedFacilities: ["missing-facility"],
      })
    }

    void verifyReadonlyDefinitions
    void verifySnapshotReferences
    expect(firstShopItemId).toBe("herb")
    expect(Object.isFrozen(content)).toBe(true)
    expect(Object.isFrozen(content.arrays)).toBe(true)
    expect(Object.isFrozen(content.arrays.items[0])).toBe(true)
    expect(Object.isFrozen(content.shopDialogues[0].products)).toBe(true)
    expect(Object.isFrozen(content.shopDialogues[0].products.itemIds)).toBe(true)
    expect(Object.isFrozen(content.shopDialogues[0].products.weaponIds)).toBe(true)
    expect(Object.isFrozen(content.shopDialogues[0].products.armorIds)).toBe(true)
    expect(Object.isFrozen(VALID_CONTENT_INPUT.items[0])).toBe(false)
    expect(Object.isFrozen(VALID_CONTENT_INPUT.shopDialogues[0].products)).toBe(false)

    // @ts-expect-error literal ID union に存在しない typo は許可しない
    expect(content.getItem("hebr")).toBeUndefined()
  })

  it("有限ID unionの通常配列を網羅tupleとして扱わない", () => {
    const items: readonly (typeof VALID_CONTENT_INPUT.items)[number][] = [
      VALID_CONTENT_INPUT.items[0],
    ]
    const content = WorldContent.create({ items })

    const verifyOptionalLookup = () => {
      // @ts-expect-error 通常配列はpotion定義の実在を証明しない
      const getterName: string = content.getItem("potion").name
      // @ts-expect-error 通常配列から作ったrecordのpropertyもoptional
      const recordName: string = content.items.potion.name
      void getterName
      void recordName
    }

    expect(verifyOptionalLookup).toBeTypeOf("function")
    expect(content.getItem("potion")).toBeUndefined()
    expect(content.items.potion).toBeUndefined()
  })

  it("TS-first shop商品を対応categoryのliteral ID unionに制約する", () => {
    const shopDialogue = VALID_CONTENT_INPUT.shopDialogues[0]
    const invalidProductsInput = {
      ...VALID_CONTENT_INPUT,
      shopDialogues: [
        {
          ...VALID_CONTENT_INPUT.shopDialogues[0],
          products: {
            itemIds: ["sword"],
            weaponIds: ["mail"],
            armorIds: ["herb"],
          },
        },
      ],
    } as const
    const missingProductsInput = {
      ...VALID_CONTENT_INPUT,
      shopDialogues: [
        {
          shopId: shopDialogue.shopId,
          shopkeeperName: shopDialogue.shopkeeperName,
          greeting: shopDialogue.greeting,
          topics: shopDialogue.topics,
        },
      ],
    } as const
    const compileInvalidProducts = () => {
      // @ts-expect-error shop商品は item / weapon / armor の対応categoryに存在する必要がある
      WorldContent.create(invalidProductsInput)
    }
    const compileMissingProducts = () => {
      // @ts-expect-error shop商品categoryは3つとも明示する
      WorldContent.create(missingProductsInput)
    }
    const mutateProducts = () => {
      const content = WorldContent.create(VALID_CONTENT_INPUT)
      // @ts-expect-error compile済み商品catalogはdeep readonly
      content.shopDialogues[0].products.itemIds.push("potion")
    }

    expect(compileInvalidProducts).toBeTypeOf("function")
    expect(compileMissingProducts).toBeTypeOf("function")
    expect(mutateProducts).toBeTypeOf("function")
  })

  it("全ID recordをnull-prototypeにし、own propertyだけを解決する", () => {
    const empty = WorldContent.parse({})
    const records = [
      empty.items,
      empty.weapons,
      empty.armors,
      empty.recipes,
      empty.monsters,
      empty.events,
      empty.areas,
      empty.npcs,
      empty.quests,
      empty.facilities,
      empty.abilities,
      empty.innPlans,
    ]

    expect(records.every((record) => Object.getPrototypeOf(record) === null)).toBe(true)
    expect(records.every((record) => Object.isFrozen(record))).toBe(true)
    expect(empty.getItem("toString")).toBeUndefined()
    expect(empty.getArea("constructor")).toBeUndefined()
    expect(empty.getFacility("__proto__")).toBeUndefined()
    expect(empty.getWeapon("constructor")).toBeUndefined()
    expect(empty.getInnPlan("constructor")).toBeUndefined()

    const namedLikePrototype = WorldContent.create({
      items: [
        {
          id: "toString",
          name: "Own item",
          description: "A valid content ID",
          itemType: "material",
          price: 1,
          sellPrice: 1,
        },
      ],
    })
    expect(Object.hasOwn(namedLikePrototype.items, "toString")).toBe(true)
    expect(namedLikePrototype.getItem("toString").name).toBe("Own item")

    const facilityNamedLikePrototype = WorldContent.create({
      areas: [
        {
          id: "field",
          name: "Field",
          description: "An open field",
          dangerLevel: 1,
          apCost: 1,
          unlocked: true,
          availableGathering: [],
          monsterIds: [],
          eventIds: [],
        },
      ],
      facilities: [
        {
          facilityId: "toString",
          type: "area_progress",
          areaId: "field",
          requiredProgress: 0,
        },
      ],
    })
    expect(Object.hasOwn(facilityNamedLikePrototype.facilities, "toString")).toBe(true)
    expect(facilityNamedLikePrototype.getFacility("toString").facilityId).toBe("toString")
  })

  it("未使用categoryを省略し、空配列へ型付きで正規化する", () => {
    const itemInput = {
      id: "single_item",
      name: "Single item",
      description: "Only one category is needed",
      itemType: "material",
      price: 1,
      sellPrice: 1,
    } as const
    const content = WorldContent.create({ items: [itemInput] })
    const parsedEmpty = WorldContent.parse({})
    const empty = WorldContent.create({})

    expect(content.items.single_item.name).toBe("Single item")
    expect(content.arrays.monsters).toEqual([])
    expect(content.arrays.quests).toEqual([])
    expect(content.arrays.innPlans).toEqual([])
    expect(Object.isFrozen(content.arrays.monsters)).toBe(true)
    expect(parsedEmpty.arrays.items).toEqual([])
    expect(empty.arrays.areas).toEqual([])

    const invalidReferenceInput = {
      monsters: [
        {
          id: "slime",
          name: "Slime",
          hp: 1,
          attack: 1,
          defense: 1,
          agility: 1,
          expReward: 0,
          goldReward: 0,
          drops: [{ itemId: "missing_item", chance: 1 }],
        },
      ],
    } as const
    const invalidReference = () => {
      // @ts-expect-error 省略されたitems categoryにdrop先IDは存在しない
      WorldContent.create(invalidReferenceInput)
    }

    expect(invalidReference).toBeTypeOf("function")
  })

  it("宿泊プランIDと回復definitionをliteral型のまま保持する", () => {
    const content = WorldContent.create({
      innPlans: [
        {
          id: "custom-rest",
          price: 7,
          hpRecovery: { fixed: 3, percent: 25 },
          mpRecovery: { percent: 50 },
          apRecovery: 2,
        },
      ],
    })

    const planId: "custom-rest" = content.getInnPlan("custom-rest").id
    const fixedRecovery: 3 = content.getInnPlan("custom-rest").hpRecovery.fixed
    const apRecovery: 2 = content.getInnPlan("custom-rest").apRecovery

    expect(planId).toBe("custom-rest")
    expect(fixedRecovery).toBe(3)
    expect(apRecovery).toBe(2)
    expect(Object.isFrozen(content.getInnPlan("custom-rest"))).toBe(true)
  })

  it("所持と戦闘で同じ canonical item 定義を共有する", () => {
    const content = WorldContent.create({
      items: [VALID_CONTENT_INPUT.items[1]],
    })
    const snapshot = content.createInitialSnapshot({
      inventory: {
        capacity: 1,
        entries: [
          {
            entryId: "potion-stack",
            contentType: "item",
            contentId: "potion",
            quantity: 1,
          },
        ],
      },
    })

    expect(createWizStandardBattleContent(content).resolveItem("potion")?.effect).toEqual({
      type: "heal",
      value: 20,
    })
    expect(snapshot.inventory.entries).toEqual([
      {
        entryId: "potion-stack",
        contentType: "item",
        contentId: "potion",
        quantity: 1,
      },
    ])
    expect(content.validateSnapshot(snapshot)).toBe(snapshot)
  })

  it("root snapshotの既定player名へ表示言語を埋め込まない", () => {
    const snapshot = WorldContent.create({}).createInitialSnapshot()

    expect(snapshot.player.name).toBe("player")
  })

  it("標準 unknown parse は schema 未宣言 field を拒否する", () => {
    const entryWithUnknownField = {
      ...VALID_CONTENT_INPUT,
      items: [
        {
          ...VALID_CONTENT_INPUT.items[1],
          customPresentation: { color: "red" },
        },
        VALID_CONTENT_INPUT.items[0],
      ],
    }
    const nestedEffectWithUnknownField = {
      ...VALID_CONTENT_INPUT,
      items: [
        {
          ...VALID_CONTENT_INPUT.items[1],
          effect: {
            ...VALID_CONTENT_INPUT.items[1].effect,
            customFormula: "level * 2",
          },
        },
        VALID_CONTENT_INPUT.items[0],
      ],
    }

    expect(zWorldContentArrays.safeParse(entryWithUnknownField).success).toBe(false)
    expect(zWorldContentArrays.safeParse(nestedEffectWithUnknownField).success).toBe(false)
  })

  it("custom schema 経路は宣言した field を保持し、未宣言 field を拒否する", () => {
    const customItemSchema = zWizContentItem.extend({
      customPresentation: z
        .strictObject({
          color: z.string(),
        })
        .optional(),
    })
    const customSchema = zWorldContentArrays.extend({
      items: z.array(customItemSchema),
    })
    const content = WorldContent.parse(
      {
        ...VALID_CONTENT_INPUT,
        items: [
          {
            ...VALID_CONTENT_INPUT.items[0],
            customPresentation: { color: "red" },
          },
          VALID_CONTENT_INPUT.items[1],
        ],
      },
      { schema: customSchema },
    )

    expect(content.arrays.items[0].customPresentation).toEqual({ color: "red" })
    expect(() =>
      WorldContent.parse(
        {
          ...VALID_CONTENT_INPUT,
          items: [
            {
              ...VALID_CONTENT_INPUT.items[0],
              customPresentation: { color: "red" },
              undeclaredPresentation: "must be rejected",
            },
            VALID_CONTENT_INPUT.items[1],
          ],
        },
        { schema: customSchema },
      ),
    ).toThrow()
  })

  it("手書きStandard Schemaの変換outputを型保持してcontent ownershipへ渡す", () => {
    const rawInput = {
      items: [
        {
          ...VALID_CONTENT_INPUT.items[0],
          price: "5",
        },
      ],
    } as const
    const canonicalOutput = zWorldContentArrays.parse({
      items: [
        {
          ...VALID_CONTENT_INPUT.items[0],
          price: 5,
        },
      ],
    })
    const presentationTags = ["restorative"]
    const schemaOutput = {
      ...canonicalOutput,
      items: [
        {
          ...VALID_CONTENT_INPUT.items[0],
          price: 5,
          sellPrice: 2,
          presentation: {
            source: "handwritten" as const,
            tags: presentationTags,
          },
        },
      ],
    }
    const schema: WizStandardSchemaDefinition<typeof rawInput, typeof schemaOutput> = {
      "~standard": {
        validate: (input: unknown) => {
          if (typeof input !== "object" || input === null || !("items" in input)) {
            return {
              issues: [{ message: "items must be present", path: ["items"] }],
            }
          }

          return { value: schemaOutput }
        },
        vendor: "world-content-test",
        version: 1,
      },
    }
    const content = WorldContent.parse(rawInput, { schema })
    const contentItem = content.getItem("herb")

    if (!contentItem) {
      throw new TypeError("Expected transformed herb content")
    }

    const source: "handwritten" = contentItem.presentation.source

    expect(() => WorldContent.create(rawInput, { schema })).toThrow(
      "WorldContent.create schema must preserve the supplied value at $.items[0].price",
    )
    Reflect.set(schemaOutput.items[0], "name", "Changed")
    schemaOutput.items[0].presentation.tags.push("mutated")

    expect(source).toBe("handwritten")
    expect(contentItem.name).toBe("Herb")
    expect(contentItem.presentation.tags).toEqual(["restorative"])
    expect(Object.isFrozen(contentItem)).toBe(true)
    expect(Object.isFrozen(contentItem.presentation.tags)).toBe(true)
  })

  it("TS-first input の参照 ID を対応 category の literal union に制約する", () => {
    const invalidReferenceInput = {
      ...VALID_CONTENT_INPUT,
      areas: [
        {
          ...VALID_CONTENT_INPUT.areas[0],
          monsterIds: ["ghost"],
        },
      ],
    } as const
    const compileInvalidReference = () => {
      // @ts-expect-error ghost は monsters の ID union に存在しない
      WorldContent.create(invalidReferenceInput)
    }

    expect(compileInvalidReference).toBeTypeOf("function")
  })

  it("完全形式の NPC dialogue を型保持し、standard compositionへ欠落なく渡す", () => {
    const content = WorldContent.create({
      ...VALID_CONTENT_INPUT,
      npcs: [
        {
          ...VALID_CONTENT_INPUT.npcs[0],
          dialogues: [
            {
              id: "choice",
              minAffinity: 0,
              lines: [{ speaker: "Narrator", text: "Choose." }],
              triggers: { afterQuest: "first_quest" },
              requirements: {
                requiredItems: [{ itemId: "herb", quantity: 1 }],
              },
              options: [
                {
                  id: "accept",
                  text: "Accept",
                  responseDialogueId: "followup",
                  requirements: {
                    requiredItems: [{ itemId: "potion", quantity: 1 }],
                  },
                  effects: {
                    giveItems: [{ itemId: "herb", quantity: 1 }],
                    takeItems: [{ itemId: "potion", quantity: 1 }],
                    startQuest: "first_quest",
                    completeQuest: "first_quest",
                    unlockDialogue: "followup",
                  },
                },
              ],
            },
            {
              id: "followup",
              minAffinity: 0,
              lines: [{ speaker: "Sage", text: "Continue." }],
            },
          ],
        },
      ],
    } as const)

    const responseId: "followup" | undefined =
      content.npcs.sage?.dialogues[0].options?.[0].responseDialogueId
    const runtimeDialogue = createWizStandardVault(content).npcs[0].dialogues[0]

    expect(responseId).toBe("followup")
    expect(runtimeDialogue.lines[0]).toEqual({ speaker: "Narrator", text: "Choose." })
    expect(runtimeDialogue.triggers).toEqual({ afterQuest: "first_quest" })
    expect(runtimeDialogue.requirements).toEqual({
      requiredItems: [{ itemId: "herb", quantity: 1 }],
    })
    expect(runtimeDialogue.options?.[0]).toMatchObject({
      responseDialogueId: "followup",
      effects: {
        startQuest: "first_quest",
        completeQuest: "first_quest",
        unlockDialogue: "followup",
      },
    })
  })

  it("完全形式 dialogue の item・quest・NPC内 dialogue 参照を compile-time 制約する", () => {
    const missingItemInput = {
      ...VALID_CONTENT_INPUT,
      npcs: [
        {
          ...VALID_CONTENT_INPUT.npcs[0],
          dialogues: [
            {
              id: "choice",
              minAffinity: 0,
              lines: [{ speaker: "Sage", text: "Choose." }],
              requirements: {
                requiredItems: [{ itemId: "missing_item", quantity: 1 }],
              },
              options: [
                {
                  id: "accept",
                  text: "Accept",
                  effects: {
                    giveItems: [{ itemId: "missing_item", quantity: 1 }],
                    takeItems: [{ itemId: "missing_item", quantity: 1 }],
                  },
                },
              ],
            },
          ],
        },
      ],
    } as const
    const missingQuestInput = {
      ...VALID_CONTENT_INPUT,
      npcs: [
        {
          ...VALID_CONTENT_INPUT.npcs[0],
          dialogues: [
            {
              id: "choice",
              minAffinity: 0,
              lines: [{ speaker: "Sage", text: "Choose." }],
              triggers: { afterQuest: "missing_quest" },
              options: [
                {
                  id: "accept",
                  text: "Accept",
                  effects: {
                    startQuest: "missing_quest",
                    completeQuest: "missing_quest",
                  },
                },
              ],
            },
          ],
        },
      ],
    } as const
    const missingDialogueInput = {
      ...VALID_CONTENT_INPUT,
      npcs: [
        {
          ...VALID_CONTENT_INPUT.npcs[0],
          dialogues: [
            {
              id: "choice",
              minAffinity: 0,
              lines: [{ speaker: "Sage", text: "Choose." }],
              options: [
                {
                  id: "accept",
                  text: "Accept",
                  responseDialogueId: "missing_dialogue",
                  effects: { unlockDialogue: "missing_dialogue" },
                },
              ],
            },
          ],
        },
      ],
    } as const
    const compileMissingItem = () => {
      // @ts-expect-error dialogue の item 参照は items の ID union に存在しない
      WorldContent.create(missingItemInput)
    }
    const compileMissingQuest = () => {
      // @ts-expect-error dialogue の quest 参照は quests の ID union に存在しない
      WorldContent.create(missingQuestInput)
    }
    const compileMissingDialogue = () => {
      // @ts-expect-error option の会話参照は同じ NPC の dialogue ID union に存在しない
      WorldContent.create(missingDialogueInput)
    }

    expect(compileMissingItem).toBeTypeOf("function")
    expect(compileMissingQuest).toBeTypeOf("function")
    expect(compileMissingDialogue).toBeTypeOf("function")
  })

  it("unknown input の完全形式 dialogue 参照を path 付きで全件拒否する", () => {
    const invalidInput = {
      ...VALID_CONTENT_INPUT,
      npcs: [
        {
          ...VALID_CONTENT_INPUT.npcs[0],
          dialogues: [
            {
              id: "choice",
              minAffinity: 0,
              lines: [{ speaker: "Sage", text: "Choose." }],
              triggers: { afterQuest: "missing_trigger_quest" },
              requirements: {
                requiredItems: [{ itemId: "missing_dialogue_item", quantity: 1 }],
              },
              options: [
                {
                  id: "accept",
                  text: "Accept",
                  responseDialogueId: "missing_response",
                  requirements: {
                    requiredItems: [{ itemId: "missing_option_item", quantity: 1 }],
                  },
                  effects: {
                    giveItems: [{ itemId: "missing_give_item", quantity: 1 }],
                    takeItems: [{ itemId: "missing_take_item", quantity: 1 }],
                    startQuest: "missing_start_quest",
                    completeQuest: "missing_complete_quest",
                    unlockDialogue: "missing_unlock",
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    expect(() => WorldContent.parse(invalidInput)).toThrow(WorldContentValidationError)

    try {
      WorldContent.parse(invalidInput)
    } catch (error) {
      const diagnostics = (error as WorldContentValidationError).diagnostics
      expect(diagnostics).toHaveLength(9)
      expect(diagnostics.map((diagnostic) => diagnostic.path)).toEqual(
        expect.arrayContaining([
          "npcs[0].dialogues[0].triggers.afterQuest",
          "npcs[0].dialogues[0].requirements.requiredItems[0].itemId",
          "npcs[0].dialogues[0].options[0].requirements.requiredItems[0].itemId",
          "npcs[0].dialogues[0].options[0].effects.giveItems[0].itemId",
          "npcs[0].dialogues[0].options[0].effects.takeItems[0].itemId",
          "npcs[0].dialogues[0].options[0].effects.startQuest",
          "npcs[0].dialogues[0].options[0].effects.completeQuest",
          "npcs[0].dialogues[0].options[0].responseDialogueId",
          "npcs[0].dialogues[0].options[0].effects.unlockDialogue",
        ]),
      )
      expect(diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            referenceId: "missing_response",
            expectedKind: "npc_dialogue",
          }),
          expect.objectContaining({
            referenceId: "missing_dialogue_item",
            expectedKind: "item",
          }),
          expect.objectContaining({
            referenceId: "missing_start_quest",
            expectedKind: "quest",
          }),
        ]),
      )
    }
  })

  it("shape 検証後も duplicate / missing / wrong-kind を最後まで集約する", () => {
    const invalidInput = {
      ...VALID_CONTENT_INPUT,
      items: [
        VALID_CONTENT_INPUT.items[0],
        VALID_CONTENT_INPUT.items[0],
        VALID_CONTENT_INPUT.items[1],
      ],
      recipes: [
        {
          ...VALID_CONTENT_INPUT.recipes[0],
          materials: [{ type: "item", itemId: "missing_material", quantity: 1 }],
          result: { type: "item", itemId: "sword" },
        },
      ],
    }

    expect(() => WorldContent.parse(invalidInput)).toThrow(WorldContentValidationError)

    try {
      WorldContent.parse(invalidInput)
    } catch (error) {
      expect(error).toBeInstanceOf(WorldContentValidationError)
      const diagnostics = (error as WorldContentValidationError).diagnostics
      expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
        "duplicate_id",
        "missing_reference",
        "wrong_reference_kind",
      ])
      expect(diagnostics[2]).toMatchObject({
        referenceId: "sword",
        expectedKind: "item",
        actualKinds: ["weapon"],
      })
      expect(Object.isFrozen(diagnostics)).toBe(true)
      expect(Object.isFrozen(diagnostics[2])).toBe(true)
    }
  })

  it("主要な content 数値境界を Zod path 付きで集約する", () => {
    const result = zWorldContentArrays.safeParse({
      ...VALID_CONTENT_INPUT,
      items: [{ ...VALID_CONTENT_INPUT.items[0], price: -1 }, VALID_CONTENT_INPUT.items[1]],
      recipes: [
        {
          ...VALID_CONTENT_INPUT.recipes[0],
          materials: [{ type: "item", itemId: "herb", quantity: 0 }],
          difficulty: -1,
        },
      ],
      monsters: [
        {
          ...VALID_CONTENT_INPUT.monsters[0],
          hp: 0,
          expReward: -1,
          drops: [{ itemId: "herb", chance: 101 }],
        },
      ],
      areas: [
        {
          ...VALID_CONTENT_INPUT.areas[0],
          dangerLevel: -1,
          apCost: -1,
        },
      ],
      abilityTable: [{ abilityId: "fire", requiredLevel: 0 }],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining([
        "items.0.price",
        "recipes.0.materials.0.quantity",
        "recipes.0.difficulty",
        "monsters.0.hp",
        "monsters.0.expReward",
        "monsters.0.drops.0.chance",
        "areas.0.dangerLevel",
        "areas.0.apCost",
        "abilityTable.0.requiredLevel",
      ]),
    )
  })

  it("NPC affinityの尺度をcontent schemaで0..100へ固定しない", () => {
    const content = WorldContent.parse({
      ...VALID_CONTENT_INPUT,
      npcs: VALID_CONTENT_INPUT.npcs.map((npc) => ({
        ...npc,
        initialAffinity: -25,
      })),
    })

    expect(content.npcs.sage?.initialAffinity).toBe(-25)
    expect(content.createInitialSnapshot().npcs[0]?.affinity).toBe(-25)
  })

  it("extend した schema で独自 category を runtime 検証し型保持する", () => {
    const extendedSchema = zWorldContentArrays.extend({
      spells: z.array(
        z.strictObject({
          id: z.string(),
          power: z.number(),
        }),
      ),
    })
    const content = WorldContent.parse(
      {
        ...VALID_CONTENT_INPUT,
        spells: [{ id: "spark", power: 3 }],
      },
      { schema: extendedSchema },
    )
    const verifyReadonlyExtension = () => {
      // @ts-expect-error custom category arrayはreadonly
      content.arrays.spells.push({ id: "flare", power: 5 })
      // @ts-expect-error custom category entryもreadonly
      content.arrays.spells[0].power = 5
    }

    void verifyReadonlyExtension
    expect(content.arrays.spells[0].power).toBe(3)
  })

  it("custom createは明示schemaだけを単一sourceとして型検査・runtime検証する", () => {
    const spellSchema = zWorldContentArrays.extend({
      spells: z.array(
        z.strictObject({
          id: z.string(),
          power: z.number().positive(),
          school: z.literal("arcane").default("arcane"),
        }),
      ),
    })
    const content = WorldContent.create(
      {
        spells: [{ id: "spark", power: 3 }],
      },
      { schema: spellSchema },
    )
    const spellId: "spark" = content.arrays.spells[0].id
    const spellSchool: "arcane" = content.arrays.spells[0].school
    const verifyStrictStandardCreate = () => {
      // @ts-expect-error 独自categoryには明示schemaが必要
      WorldContent.create({ spells: [{ id: "spark", power: 3 }] })
      // @ts-expect-error 標準entryの独自fieldにも明示schemaが必要
      WorldContent.create({
        items: [
          {
            ...VALID_CONTENT_INPUT.items[0],
            customPresentation: { color: "red" },
          },
        ],
      })
      // @ts-expect-error custom definitionはschema input型に従う
      WorldContent.create({ spells: [{ id: "spark", power: "3" }] }, { schema: spellSchema })
    }
    const verifyReadonlySpell = () => {
      // @ts-expect-error schema outputはdeep readonly
      content.arrays.spells[0].power = 5
    }

    void verifyStrictStandardCreate
    void verifyReadonlySpell
    expect(spellId).toBe("spark")
    expect(spellSchool).toBe("arcane")
    expect(content.arrays.spells[0]).toEqual({ id: "spark", power: 3, school: "arcane" })
    expect(Object.isFrozen(content.arrays.spells[0])).toBe(true)
    expect(() =>
      WorldContent.create(
        {
          spells: [{ id: "spark", power: -1 }],
        },
        { schema: spellSchema },
      ),
    ).toThrow()
  })

  it("custom createはimmutable classをnominal型とmethodごとatomicに保持する", () => {
    class Lore {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true
      readonly #meaning: number

      constructor(
        readonly id: string,
        meaning: number,
      ) {
        this.#meaning = meaning
        WizImmutableValue.freeze(this)
      }

      reveal(): number {
        return this.#meaning
      }
    }

    const loreSchema = zWorldContentArrays.extend({
      lore: z.array(z.custom<Lore>((value) => value instanceof Lore)),
    })
    const lore = new Lore("origin", 42)
    const content = WorldContent.create({ lore: [lore] }, { schema: loreSchema })
    const exactLore: Lore = content.arrays.lore[0]

    expect(exactLore).toBe(lore)
    expect(exactLore.reveal()).toBe(42)
  })

  it("custom createもbuilt-in categoryの参照をcompile-time検証する", () => {
    const extendedSchema = zWorldContentArrays.extend({
      spells: z.array(z.strictObject({ id: z.string() })),
    })
    const invalidReferenceInput = {
      spells: [],
      monsters: [
        {
          id: "slime",
          name: "Slime",
          hp: 1,
          attack: 1,
          defense: 1,
          agility: 1,
          expReward: 0,
          goldReward: 0,
          drops: [{ itemId: "missing_item", chance: 1 }],
        },
      ],
    } as const
    const verifyReferenceConstraint = () => {
      // @ts-expect-error custom schemaでもdrop先item IDはcontent内に存在しなければならない
      WorldContent.create(invalidReferenceInput, { schema: extendedSchema })
    }

    void verifyReferenceConstraint
    expect(() => WorldContent.parse(invalidReferenceInput, { schema: extendedSchema })).toThrow(
      WorldContentValidationError,
    )
  })

  it("custom createはliteralを書き換えるtransformを拒否し、unknown parseだけが適用する", () => {
    const rewritingSpellSchema = zWorldContentArrays.extend({
      spells: z.array(
        z
          .strictObject({
            id: z.string(),
            power: z.number(),
          })
          .transform((spell) => ({
            ...spell,
            id: `rewritten-${spell.id}`,
          })),
      ),
    })
    const input = {
      spells: [{ id: "spark", power: 3 }],
    } as const

    expect(() => WorldContent.create(input, { schema: rewritingSpellSchema })).toThrow(
      "WorldContent.create schema must preserve the supplied value at $.spells[0].id",
    )
    expect(
      WorldContent.parse(input, {
        schema: rewritingSpellSchema,
      }).arrays.spells[0].id,
    ).toBe("rewritten-spark")
  })

  it("静的 definition を複製しない WorldSnapshot を作る", () => {
    const content = WorldContent.create(VALID_CONTENT_INPUT)
    const snapshot = content.createInitialSnapshot()

    expect(snapshot).toBeInstanceOf(WorldSnapshot)
    expect(snapshot.areas).toEqual([{ id: "field", progress: 0, unlocked: true }])
    expect(snapshot.npcs).toEqual([{ id: "sage", affinity: 0 }])
    expect(snapshot.quests).toEqual([
      {
        id: "first_quest",
        accepted: false,
        completed: false,
        progress: 0,
      },
    ])
    expect(snapshot.partyMembers).toEqual([])
    expect("monsters" in snapshot.areas[0]).toBe(false)
    expect("name" in snapshot.npcs[0]).toBe(false)
    expect(content.validateSnapshot(snapshot)).toBe(snapshot)
  })

  it("snapshot validation境界でprototype偽装instanceを拒否する", () => {
    const content = WorldContent.create(VALID_CONTENT_INPUT)
    const snapshot = content.createInitialSnapshot()
    const forgedSnapshot = Object.create(WorldSnapshot.prototype)
    Object.defineProperty(forgedSnapshot, "properties", {
      configurable: true,
      enumerable: false,
      value: snapshot.clonePlain(),
      writable: true,
    })

    expect(() => content.validateSnapshot(forgedSnapshot)).toThrow(
      "WorldSnapshot instance failed runtime authenticity validation",
    )
    expect(() => content.reconcileSnapshot(forgedSnapshot, "keep")).toThrow(
      "WorldSnapshot instance failed runtime authenticity validation",
    )
  })

  it("battle ability がない World でも固定 party を注入せず自己整合する", () => {
    const content = WorldContent.create({
      ...VALID_CONTENT_INPUT,
      abilities: [],
      abilityTable: [],
    })
    const snapshot = content.createInitialSnapshot()

    expect(snapshot.player.abilityIds).toEqual([])
    expect(snapshot.partyMembers).toEqual([])
    expect(content.validateSnapshot(snapshot)).toBe(snapshot)
  })

  it("historical log は削除済み content ID を保持し、現在 state の ID union と分離する", () => {
    const content = WorldContent.create({})
    const snapshot = content.createInitialSnapshot({
      log: [{ key: "AREA_UNLOCKED", areaId: "retired-area" }],
    })
    const message = snapshot.log[0]

    if (message.key !== "AREA_UNLOCKED") {
      throw new TypeError("Expected AREA_UNLOCKED historical log")
    }
    const historicalAreaId: string = message.areaId
    // @ts-expect-error historical receiptは現在contentに存在するarea IDを保証しない。
    const currentAreaId: never = message.areaId
    void historicalAreaId
    void currentAreaId

    expect(content.validateSnapshot(snapshot)).toBe(snapshot)
    expect(message.areaId).toBe("retired-area")
  })

  it("vault adapter は content 外の固定 ability ID を snapshot へ漏らさない", () => {
    const empty = WorldContent.create({})
    const vault = createWizStandardVault(empty)
    const snapshot = WorldSnapshot.fromVault(vault)

    expect(vault.player.abilityIds).toEqual([])
    expect(vault.partyMembers.map((member) => member.abilityIds)).toEqual([[], []])
    expect(empty.validateSnapshot(snapshot)).toBe(snapshot)

    const content = WorldContent.create(VALID_CONTENT_INPUT)
    const contentVault = createWizStandardVault(content)
    const contentSnapshot = WorldSnapshot.fromVault(contentVault)

    expect(contentVault.partyMembers.map((member) => member.abilityIds)).toEqual([
      ["heal"],
      ["powerStrike"],
    ])
    expect(content.validateSnapshot(contentSnapshot)).toBe(contentSnapshot)
  })

  it("snapshot 内の duplicate / missing / wrong-kind ID を集約して拒否する", () => {
    const content = WorldContent.create(VALID_CONTENT_INPUT)
    const initial = content.createInitialSnapshot().toPlain()
    const invalid = WorldSnapshot.create({
      ...initial,
      areas: [initial.areas[0], initial.areas[0]],
      quests: [{ ...initial.quests[0], id: "missing_quest" }],
      inventory: {
        ...initial.inventory,
        entries: [
          {
            entryId: "wrong-kind-entry",
            contentType: "item",
            contentId: "sword",
            quantity: 1,
          },
        ],
      },
    })
    const directDiagnostics = diagnoseWorldSnapshot(content.arrays, invalid.toPlain())

    expect(Object.isFrozen(directDiagnostics)).toBe(true)
    expect(directDiagnostics.every(Object.isFrozen)).toBe(true)
    const wrongKind = directDiagnostics.find(
      (diagnostic) => diagnostic.code === "wrong_reference_kind",
    )
    expect(wrongKind?.code).toBe("wrong_reference_kind")
    if (wrongKind?.code === "wrong_reference_kind") {
      expect(Object.isFrozen(wrongKind.actualKinds)).toBe(true)
    }

    expect(() => content.validateSnapshot(invalid)).toThrow(WorldSnapshotValidationError)

    try {
      content.validateSnapshot(invalid)
    } catch (error) {
      const diagnostics = (error as WorldSnapshotValidationError).diagnostics
      expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("duplicate_id")
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          code: "missing_reference",
          expectedKind: "quest",
          id: "missing_quest",
        }),
      )
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          code: "wrong_reference_kind",
          expectedKind: "item",
          id: "sword",
          actualKinds: ["weapon"],
        }),
      )
    }
  })

  it("defeat quest の progress は有限整数かつ定義 count 以内だけを受理する", () => {
    const content = WorldContent.create(VALID_CONTENT_INPUT)
    const initial = content.createInitialSnapshot().toPlain()

    for (const [progress, reason] of [
      [0.5, "not_finite_integer"],
      [2, "out_of_range"],
    ] as const) {
      const snapshot = WorldSnapshot.create({
        ...initial,
        quests: [{ ...initial.quests[0], accepted: true, progress }],
      })
      const diagnostics = diagnoseWorldSnapshot(content.arrays, snapshot.toPlain())

      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          code: "invalid_quest_progress",
          expectedKind: "quest",
          id: "first_quest",
          path: "quests[0].progress",
          objectiveType: "defeat",
          reason,
          progress,
          minimum: 0,
          maximum: 1,
        }),
      )
      expect(() => content.validateSnapshot(snapshot)).toThrow(WorldSnapshotValidationError)
    }
  })

  it("gather quest の progress 欠落を content definition と照合して拒否する", () => {
    const content = WorldContent.parse({
      ...VALID_CONTENT_INPUT,
      quests: [
        {
          ...VALID_CONTENT_INPUT.quests[0],
          objective: { type: "gather", itemId: "herb", count: 2 },
        },
      ],
    })
    const initial = content.createInitialSnapshot().toPlain()
    const quest = initial.quests[0]
    const snapshot = WorldSnapshot.create({
      ...initial,
      quests: [
        {
          id: quest.id,
          accepted: true,
          completed: quest.completed,
        },
      ],
    })
    const diagnostics = diagnoseWorldSnapshot(content.arrays, snapshot.toPlain())

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "invalid_quest_progress",
        expectedKind: "quest",
        id: "first_quest",
        path: "quests[0].progress",
        objectiveType: "gather",
        reason: "required",
        minimum: 0,
        maximum: 2,
      }),
    )
    expect(() => content.validateSnapshot(snapshot)).toThrow(WorldSnapshotValidationError)
  })

  it("explore / deliver quest に複製した progress を拒否する", () => {
    for (const objective of [
      { type: "explore", areaId: "field", requiredProgress: 50 },
      { type: "deliver", itemId: "herb", npcId: "sage" },
    ] as const) {
      const content = WorldContent.parse({
        ...VALID_CONTENT_INPUT,
        quests: [{ ...VALID_CONTENT_INPUT.quests[0], objective }],
      })
      const initial = content.createInitialSnapshot().toPlain()
      const snapshot = WorldSnapshot.create({
        ...initial,
        quests: [{ ...initial.quests[0], progress: 1 }],
      })
      const diagnostics = diagnoseWorldSnapshot(content.arrays, snapshot.toPlain())

      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          code: "invalid_quest_progress",
          expectedKind: "quest",
          id: "first_quest",
          path: "quests[0].progress",
          objectiveType: objective.type,
          reason: "not_allowed",
          progress: 1,
        }),
      )
      expect(() => content.validateSnapshot(snapshot)).toThrow(WorldSnapshotValidationError)
    }
  })

  it("未受理の quest を completed にした snapshot を拒否する", () => {
    const content = WorldContent.create(VALID_CONTENT_INPUT)
    const initial = content.createInitialSnapshot().toPlain()
    const snapshot = WorldSnapshot.create({
      ...initial,
      quests: [{ ...initial.quests[0], accepted: false, completed: true }],
    })
    const diagnostics = diagnoseWorldSnapshot(content.arrays, snapshot.toPlain())

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "invalid_quest_completion",
        expectedKind: "quest",
        id: "first_quest",
        path: "quests[0].completed",
        reason: "completed_without_acceptance",
      }),
    )
    expect(() => content.validateSnapshot(snapshot)).toThrow(WorldSnapshotValidationError)
  })

  it("set semantics の snapshot ID 重複を正確な path 付きで集約する", () => {
    const content = WorldContent.create(VALID_CONTENT_INPUT)
    const initial = content.createInitialSnapshot().toPlain()
    const member = WorldSnapshot.fromVault(createWizStandardVault(content)).partyMembers[0]!
    const snapshot = WorldSnapshot.create({
      ...initial,
      player: {
        ...initial.player,
        abilityIds: ["fire", "fire"],
      },
      partyMembers: [{ ...member, abilityIds: ["heal", "heal"] }],
      flags: ["opened_gate", "opened_gate"],
      unlockedFacilities: ["alchemy", "alchemy"],
    })
    const diagnostics = diagnoseWorldSnapshot(content.arrays, snapshot.toPlain())

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "duplicate_id",
          expectedKind: "ability",
          id: "fire",
          path: "player.abilityIds[1]",
          firstPath: "player.abilityIds[0]",
        }),
        expect.objectContaining({
          code: "duplicate_id",
          expectedKind: "ability",
          id: "heal",
          path: "partyMembers[0].abilityIds[1]",
          firstPath: "partyMembers[0].abilityIds[0]",
        }),
        expect.objectContaining({
          code: "duplicate_id",
          expectedKind: "flag",
          id: "opened_gate",
          path: "flags[1]",
          firstPath: "flags[0]",
        }),
        expect.objectContaining({
          code: "duplicate_id",
          expectedKind: "facility",
          id: "alchemy",
          path: "unlockedFacilities[1]",
          firstPath: "unlockedFacilities[0]",
        }),
      ]),
    )
    expect(Object.isFrozen(diagnostics)).toBe(true)
    expect(diagnostics.every(Object.isFrozen)).toBe(true)
    expect(() => content.validateSnapshot(snapshot)).toThrow(WorldSnapshotValidationError)
  })

  it("party memberの空・前後空白IDをpath付きで診断する", () => {
    const content = WorldContent.create(VALID_CONTENT_INPUT)
    const initial = content.createInitialSnapshot().toPlain()
    const member = WorldSnapshot.fromVault(createWizStandardVault(content)).partyMembers[0]!
    const diagnostics = diagnoseWorldSnapshot(content.arrays, {
      ...initial,
      partyMembers: [
        { ...member, id: " " },
        { ...member, id: " member " },
      ],
    })

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_id",
          expectedKind: "party_member",
          path: "partyMembers[0].id",
          reason: "empty_or_whitespace",
        }),
        expect.objectContaining({
          code: "invalid_id",
          expectedKind: "party_member",
          path: "partyMembers[1].id",
          reason: "leading_or_trailing_whitespace",
        }),
      ]),
    )
  })

  it("定義に必要な state が欠けた snapshot を黙って初期化せず、全 path を集約する", () => {
    const content = WorldContent.create(VALID_CONTENT_INPUT)
    const initial = content.createInitialSnapshot().toPlain()
    const incomplete = WorldSnapshot.create({
      ...initial,
      areas: [],
      npcs: [],
      quests: [],
    })
    const diagnostics = diagnoseWorldSnapshot(content.arrays, incomplete.toPlain())

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_state",
          expectedKind: "area",
          id: "field",
          path: "areas[0].id",
        }),
        expect.objectContaining({
          code: "missing_state",
          expectedKind: "npc",
          id: "sage",
          path: "npcs[0].id",
        }),
        expect.objectContaining({
          code: "missing_state",
          expectedKind: "quest",
          id: "first_quest",
          path: "quests[0].id",
        }),
      ]),
    )
    expect(Object.isFrozen(diagnostics)).toBe(true)
    expect(diagnostics.every(Object.isFrozen)).toBe(true)
    expect(() => content.validateSnapshot(incomplete)).toThrow(WorldSnapshotValidationError)

    const reconciled = content.reconcileSnapshot(incomplete, "drop")
    expect(reconciled.areas.map((state) => state.id)).toEqual(["field"])
    expect(reconciled.npcs.map((state) => state.id)).toEqual(["sage"])
    expect(reconciled.quests.map((state) => state.id)).toEqual(["first_quest"])
  })

  it("party actor ID の duplicate と予約済み player を path 付きで診断する", () => {
    const content = WorldContent.create(VALID_CONTENT_INPUT)
    const initial = content.createInitialSnapshot().toPlain()
    const member = {
      id: "guest",
      name: "Guest",
      classId: "warrior" as const,
      level: 1,
      hp: 10,
      maxHp: 10,
      mp: 5,
      maxMp: 5,
      attributes: {
        strength: 1,
        dexterity: 1,
        agility: 1,
        vitality: 1,
        wisdom: 1,
        charisma: 1,
      },
      abilityIds: [],
    }
    const unsafeData = {
      ...initial,
      partyMembers: [{ ...member, id: "player" }, member, { ...member }],
    }
    const diagnostics = diagnoseWorldSnapshot(content.arrays, unsafeData)

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "reserved_id",
          expectedKind: "party_member",
          id: "player",
          path: "partyMembers[0].id",
        }),
        expect.objectContaining({
          code: "duplicate_id",
          expectedKind: "party_member",
          id: "guest",
          path: "partyMembers[2].id",
          firstPath: "partyMembers[1].id",
        }),
      ]),
    )
    expect(Object.isFrozen(diagnostics)).toBe(true)
    expect(diagnostics.every(Object.isFrozen)).toBe(true)
  })

  it("snapshot を新 content に immutable reconcile し、新規 state を既定値で追加する", () => {
    const oldContent = WorldContent.create(VALID_CONTENT_INPUT)
    const oldInitial = oldContent.createInitialSnapshot().toPlain()
    const oldSnapshot = WorldSnapshot.create({
      ...oldInitial,
      areas: [
        { ...oldInitial.areas[0], progress: 42 },
        { id: "retired_area", progress: 80, unlocked: true },
      ],
      npcs: [
        { ...oldInitial.npcs[0], affinity: 35 },
        { id: "retired_npc", affinity: 70 },
      ],
      quests: [
        { ...oldInitial.quests[0], accepted: true, progress: 1 },
        { id: "retired_quest", accepted: true, completed: true, progress: 5 },
      ],
    })
    const expandedContent = WorldContent.create({
      ...VALID_CONTENT_INPUT,
      areas: [
        ...VALID_CONTENT_INPUT.areas,
        {
          id: "cave",
          name: "Cave",
          description: "A new cave",
          dangerLevel: 2,
          apCost: 1,
          unlocked: false,
          availableGathering: [],
          monsterIds: [],
          eventIds: [],
        },
      ],
      npcs: [
        ...VALID_CONTENT_INPUT.npcs,
        {
          id: "smith",
          name: "Smith",
          occupation: "Smith",
          personality: "Quiet",
          initialAffinity: 5,
          likes: [],
          dislikes: [],
          dialogues: [],
        },
      ],
      quests: [
        ...VALID_CONTENT_INPUT.quests,
        {
          id: "second_quest",
          name: "Second quest",
          description: "Defeat another slime",
          giverNpcId: "smith",
          objective: { type: "defeat", monsterId: "slime", count: 2 },
          reward: { gold: 0, exp: 0, affinityBonus: 0 },
        },
      ],
    })

    const reconciled = expandedContent.reconcileSnapshot(oldSnapshot, "drop")
    const reconciledAreaId: "field" | "cave" = reconciled.areas[0].id
    void reconciledAreaId

    expect(reconciled.areas).toEqual([
      { id: "field", progress: 42, unlocked: true },
      { id: "cave", progress: 0, unlocked: false },
    ])
    expect(reconciled.npcs).toEqual([
      { id: "sage", affinity: 35 },
      { id: "smith", affinity: 5 },
    ])
    expect(reconciled.quests).toEqual([
      { id: "first_quest", accepted: true, completed: false, progress: 1 },
      { id: "second_quest", accepted: false, completed: false, progress: 0 },
    ])
    expect(reconciled.inventory.entries).toEqual([])
    expect(reconciled.player.abilityIds).toEqual([])
    expect(reconciled.unlockedFacilities).toEqual([])
    expect(oldSnapshot.areas.map((area) => area.id)).toEqual(["field", "retired_area"])
    expect(Object.isFrozen(reconciled.toPlain())).toBe(true)
    expect("contentVersion" in reconciled.toPlain()).toBe(false)

    const kept = expandedContent.reconcileSnapshot(oldSnapshot, "keep")
    const keptAreaId: string = kept.areas[0].id
    // @ts-expect-error keep は廃止済み ID も保持するため、現行 content の ID union ではない。
    const currentAreaId: "field" | "cave" = kept.areas[0].id
    void keptAreaId
    void currentAreaId
    expect(kept.areas.map((area) => area.id)).toEqual(["field", "cave", "retired_area"])
    expect(kept.npcs.map((npc) => npc.id)).toEqual(["sage", "smith", "retired_npc"])
    expect(kept.quests.map((quest) => quest.id)).toEqual([
      "first_quest",
      "second_quest",
      "retired_quest",
    ])
  })

  it("reconcile error policy は orphan と duplicate を集約して拒否する", () => {
    expect(Object.isFrozen(WORLD_SNAPSHOT_ORPHAN_POLICIES)).toBe(true)

    const content = WorldContent.create(VALID_CONTENT_INPUT)
    const initial = content.createInitialSnapshot().toPlain()
    const snapshot = WorldSnapshot.create({
      ...initial,
      areas: [
        initial.areas[0],
        initial.areas[0],
        { id: "retired_area", progress: 0, unlocked: false },
      ],
      npcs: [...initial.npcs, { id: "retired_npc", affinity: 0 }],
      quests: [...initial.quests, { id: "retired_quest", accepted: false, completed: false }],
    })

    expect(() => content.reconcileSnapshot(snapshot, "error")).toThrow(WorldSnapshotReconcileError)
    try {
      content.reconcileSnapshot(snapshot, "error")
    } catch (error) {
      const diagnostics = (error as WorldSnapshotReconcileError).diagnostics
      expect(diagnostics).toHaveLength(4)
      expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
        "duplicate_id",
        "orphaned_state",
        "orphaned_state",
        "orphaned_state",
      ])
      expect(Object.isFrozen(diagnostics)).toBe(true)
      expect(Object.isFrozen(diagnostics[0])).toBe(true)
    }
  })

  it("文字列 drop は全参照 category に適用し、順序・数量を保って除去する", () => {
    const { content, snapshot } = createSnapshotWithOrphanedReferences()

    const dropped = content.reconcileSnapshot(snapshot, "drop")

    expect(dropped.inventory.entries).toEqual([
      { entryId: "herb-stack", contentType: "item", contentId: "herb", quantity: 3 },
      { entryId: "potion-stack", contentType: "item", contentId: "potion", quantity: 2 },
      { entryId: "sword-1", contentType: "weapon", contentId: "sword", quantity: 1 },
      { entryId: "sword-2", contentType: "weapon", contentId: "sword", quantity: 1 },
      { entryId: "mail-1", contentType: "armor", contentId: "mail", quantity: 1 },
    ])
    expect(dropped.equipment).toEqual({
      mainHand: null,
      body: null,
    })
    expect(dropped.player.abilityIds).toEqual(["fire", "heal"])
    expect(dropped.partyMembers[0].abilityIds).toEqual(["powerStrike"])
    expect(dropped.unlockedFacilities).toEqual(["alchemy"])
    expect(snapshot.inventory.entries[1]).toEqual({
      entryId: "retired-item-stack",
      contentType: "item",
      contentId: "retired_item",
      quantity: 7,
    })
    expect(Object.isFrozen(dropped.toPlain())).toBe(true)
  })

  it("category object は指定 category だけを上書きし、他を keep する", () => {
    const { content, snapshot } = createSnapshotWithOrphanedReferences()
    const selective = content.reconcileSnapshot(snapshot, {
      items: "drop",
      abilities: "drop",
    })
    expect(
      selective.inventory.entries
        .filter((entry) => entry.contentType === "item")
        .map((entry) => entry.contentId),
    ).toEqual(["herb", "potion"])
    expect(selective.player.abilityIds).toEqual(["fire", "heal"])
    expect(selective.inventory.entries.filter((entry) => entry.contentType === "weapon")).toEqual(
      snapshot.inventory.entries.filter((entry) => entry.contentType === "weapon"),
    )
    expect(selective.equipment).toEqual(snapshot.equipment)
    expect(selective.unlockedFacilities).toEqual(snapshot.unlockedFacilities)
  })

  it("文字列 error は inventory/equipment/abilities/facilities を全件診断する", () => {
    const { content, snapshot } = createSnapshotWithOrphanedReferences()

    expect(() => content.reconcileSnapshot(snapshot, "error")).toThrow(WorldSnapshotReconcileError)
    try {
      content.reconcileSnapshot(snapshot, "error")
    } catch (error) {
      const diagnostics = (error as WorldSnapshotReconcileError).diagnostics
      expect(diagnostics).toHaveLength(6)
      expect(diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
        "inventory.entries[1].contentId",
        "inventory.entries[4].contentId",
        "inventory.entries[7].contentId",
        "player.abilityIds[1]",
        "partyMembers[0].abilityIds[1]",
        "unlockedFacilities[1]",
      ])
      expect(diagnostics.map((diagnostic) => diagnostic.kind)).toEqual([
        "item",
        "weapon",
        "armor",
        "ability",
        "ability",
        "facility",
      ])
      expect(Object.isFrozen(diagnostics)).toBe(true)
    }
  })

  it("battle category を統一入口から resolver へ渡せる", () => {
    const content = WorldContent.create(VALID_CONTENT_INPUT)
    const battleContent = createWizStandardBattleContent(content)

    expect(battleContent.resolveItem("potion")?.effect).toEqual({ type: "heal", value: 20 })
    expect(battleContent.resolveAbility("fire")?.effect.power).toBe(10)
    expect(
      createWizStandardShopDialogueService(content).getDialogue("village_shop")?.greeting,
    ).toBe("Welcome")
    expect(createWizStandardAbilityLearning(content).getNewAbilities(2, [])).toEqual(["fire"])
  })
})
