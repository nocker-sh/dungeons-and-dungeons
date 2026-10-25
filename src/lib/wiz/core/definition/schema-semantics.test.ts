import { describe, expect, it } from "vite-plus/test"
import { WorldContentValidationError } from "@/lib/wiz/core/content/diagnostic"
import { WorldContent } from "@/lib/wiz/core/content/world-content"
import { zWizContentArea } from "@/lib/wiz/core/definition/area/area"
import { zWizContentEventChoice } from "@/lib/wiz/core/definition/event/event-choice"
import { zWizContentEventReward } from "@/lib/wiz/core/definition/event/event-reward"
import { zWizContentConsumableEffect } from "@/lib/wiz/core/definition/item/consumable-effect"
import { zWizContentItem } from "@/lib/wiz/core/definition/item/item"
import {
  zWizContentDialogue,
  zWizContentDialogueEffects,
  zWizContentDialogueOption,
} from "@/lib/wiz/core/definition/npc/dialogue"
import { zWizContentNpc } from "@/lib/wiz/core/definition/npc/npc"
import { zWizContentQuestReward } from "@/lib/wiz/core/definition/quest/quest"
import { zWizContentRecipe } from "@/lib/wiz/core/definition/recipe/recipe"
import {
  zWizContentShopDialogue,
  zWizContentShopDialogueTopic,
} from "@/lib/wiz/core/definition/shop/dialogue"

const itemDefinition = {
  id: "potion",
  name: "Potion",
  description: "Restores HP",
  itemType: "consumable",
  price: 10,
  sellPrice: 5,
  effect: { type: "heal", value: 10 },
} as const

const areaDefinition = {
  id: "forest",
  name: "Forest",
  description: "A forest",
  dangerLevel: 1,
  apCost: 1,
  unlocked: true,
  availableGathering: [],
  monsterIds: [],
  eventIds: [],
} as const

const npcDefinition = {
  id: "guide",
  name: "Guide",
  occupation: "Guide",
  personality: "Calm",
  initialAffinity: 0,
  likes: [],
  dislikes: [],
  dialogues: [],
} as const

const withRetiredProperty = <TValue extends object>(
  value: TValue,
  nameParts: readonly string[],
  retiredValue: unknown,
): TValue => {
  const result = { ...value }
  Object.defineProperty(result, nameParts.join(""), {
    enumerable: true,
    value: retiredValue,
  })
  return result
}

describe("consumable effect content contract", () => {
  it.each([
    { type: "heal", value: -1 },
    { type: "restore_mp", value: Number.POSITIVE_INFINITY },
    { type: "food", hungerRestore: Number.NaN },
    { type: "food", hungerRestore: 1, healValue: -1 },
    { type: "revive", value: -1 },
    { type: "revive", value: 0 },
    { type: "buff", stat: "strength", value: 1, duration: -1 },
    { type: "buff", stat: "strength", value: 1, duration: 1.5 },
    {
      type: "buff",
      stat: "strength",
      value: 1,
      duration: Number.MAX_SAFE_INTEGER + 1,
    },
    { type: "buff", stat: "attack", value: 0, duration: 1 },
    { type: "buff", stat: "attack", value: Number.NaN, duration: 1 },
    { type: "buff", stat: "defense", value: 1, duration: 0 },
    { type: "damage", value: 0 },
    { type: "damage", value: -1 },
    { type: "poison", value: Number.POSITIVE_INFINITY },
    { type: "trap", value: -1 },
    { type: "fuel", value: Number.NaN },
  ])("effectごとの意味制約を満たさない数値を拒否する: $type", (effect) => {
    expect(zWizContentConsumableEffect.safeParse(effect).success).toBe(false)
  })

  it("0が意味を持つ回復量は正規入力として受理する", () => {
    expect(zWizContentConsumableEffect.safeParse({ type: "restore_mp", value: 0 }).success).toBe(
      true,
    )
    expect(
      zWizContentConsumableEffect.safeParse({
        type: "buff",
        stat: "attack",
        value: 1,
        duration: 1,
      }).success,
    ).toBe(true)
    expect(zWizContentConsumableEffect.safeParse({ type: "revive" }).success).toBe(true)
  })

  it.each([
    { type: "buff", stat: " ", value: 1, duration: 1 },
    { type: "damage", value: 1, element: " fire" },
    { type: "teleport", destination: "" },
    { type: "teleport", targetId: "target " },
    { type: "unlock", targetId: "\t" },
  ])("空白または前後空白付きのsemantic文字列を拒否する: $type", (effect) => {
    expect(zWizContentConsumableEffect.safeParse(effect).success).toBe(false)
  })

  it("status cureは任意のsemantic effect IDまたは全解除を表す", () => {
    expect(
      zWizContentConsumableEffect.safeParse({
        type: "cure",
        effectId: "poison",
      }).success,
    ).toBe(true)
    expect(zWizContentConsumableEffect.safeParse({ type: "cure" }).success).toBe(true)
    expect(
      zWizContentConsumableEffect.safeParse({
        type: "cure",
        effectId: " poison ",
      }).success,
    ).toBe(false)
  })
})

describe("nested content canonicalization", () => {
  it.each([
    { stat: "strength" as const },
    { difficulty: 5 },
    { stat: "strength" as const, difficulty: 0 },
  ])("event skill checkの片側だけまたは無意味な難易度を拒否する", (check) => {
    expect(
      zWizContentEventChoice.safeParse({
        label: "Try",
        successText: "Success",
        failText: "Failure",
        ...check,
      }).success,
    ).toBe(false)
  })

  it("recipeの同一素材重複を拒否する", () => {
    const result = zWizContentRecipe.safeParse({
      id: "potion",
      name: "Potion",
      description: "Brew",
      materials: [
        { type: "item", itemId: "herb", quantity: 1 },
        { type: "item", itemId: "herb", quantity: 2 },
      ],
      result: { type: "item", itemId: "potion" },
      difficulty: 1,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path)).toContainEqual([
        "materials",
        1,
        "itemId",
      ])
    }
  })

  it("quantityで表現できるevent/quest報酬の重複を拒否する", () => {
    expect(
      zWizContentEventReward.safeParse({
        items: [
          { itemId: "herb", quantity: 1 },
          { itemId: "herb", quantity: 2 },
        ],
      }).success,
    ).toBe(false)
    expect(
      zWizContentQuestReward.safeParse({
        gold: 0,
        exp: 0,
        affinityBonus: 0,
        items: [
          { type: "weapon", weaponId: "sword", quantity: 1 },
          { type: "weapon", weaponId: "sword", quantity: 2 },
        ],
      }).success,
    ).toBe(false)
  })

  it("NPCの重複・矛盾するgift preferenceを拒否する", () => {
    expect(
      zWizContentNpc.safeParse({
        ...npcDefinition,
        likes: ["herb", "herb"],
      }).success,
    ).toBe(false)
    expect(
      zWizContentNpc.safeParse({
        ...npcDefinition,
        likes: ["herb"],
        dislikes: ["herb"],
      }).success,
    ).toBe(false)
  })

  it("dialogueの不可能な範囲・重複要件・矛盾するflag操作を拒否する", () => {
    expect(
      zWizContentDialogue.safeParse({
        id: "invalid",
        minAffinity: 5,
        maxAffinity: 4,
        lines: [],
      }).success,
    ).toBe(false)
    expect(
      zWizContentDialogueOption.safeParse({
        id: "invalid",
        text: "Invalid",
        requirements: {
          requiredItems: [
            { itemId: "pass", quantity: 1 },
            { itemId: "pass", quantity: 2 },
          ],
        },
      }).success,
    ).toBe(false)
    expect(
      zWizContentDialogueOption.safeParse({
        id: "invalid",
        text: "Invalid",
        requirements: {
          requiredFlags: ["opened"],
          forbiddenFlags: ["opened"],
        },
      }).success,
    ).toBe(false)
    expect(
      zWizContentDialogueEffects.safeParse({
        setFlags: ["opened"],
        removeFlags: ["opened"],
      }).success,
    ).toBe(false)
  })

  it("shopの不可能なlevel範囲・空topic・廃止済みeffect fieldを拒否する", () => {
    expect(
      zWizContentShopDialogue.safeParse({
        shopId: "shop",
        shopkeeperName: "Keeper",
        greeting: "Welcome",
        products: { itemIds: [], weaponIds: [], armorIds: [] },
        topics: [
          {
            id: "invalid",
            label: "Invalid",
            condition: { minLevel: 3, maxLevel: 2 },
            lines: [{ speaker: "shopkeeper", text: "Invalid" }],
          },
        ],
      }).success,
    ).toBe(false)
    expect(
      zWizContentShopDialogueTopic.safeParse({
        id: "empty",
        label: "Empty",
        lines: [],
      }).success,
    ).toBe(false)
    expect(
      zWizContentShopDialogueTopic.safeParse({
        id: "retired",
        label: "Retired",
        lines: [{ speaker: "shopkeeper", text: "Retired" }],
        effects: withRetiredProperty({}, ["add", "Affinity"], 1),
      }).success,
    ).toBe(false)
  })
})

describe("single content authorities", () => {
  it("廃止した重複fieldをstrict schemaで拒否する", () => {
    expect(
      zWizContentItem.safeParse(withRetiredProperty(itemDefinition, ["stack", "able"], true))
        .success,
    ).toBe(false)
    expect(
      zWizContentNpc.safeParse(withRetiredProperty(npcDefinition, ["available", "Quests"], []))
        .success,
    ).toBe(false)
    expect(
      zWizContentArea.safeParse(
        withRetiredProperty(areaDefinition, ["action", "Labels"], {
          explore: "Explore",
        }),
      ).success,
    ).toBe(false)
  })

  it("前後空白付きIDを正規IDと別物として受理しない", () => {
    try {
      WorldContent.parse({
        items: [{ ...itemDefinition, id: " potion " }],
      })
      throw new Error("Expected content validation to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(WorldContentValidationError)
      if (!(error instanceof WorldContentValidationError)) throw error
      expect(error.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "invalid_id",
          path: "items[0].id",
          reason: "surrounding_whitespace",
        }),
      )
    }
  })
})
