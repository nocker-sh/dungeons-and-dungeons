import { describe, expect, it } from "vite-plus/test"
import {
  zWizContentDialogue,
  zWizContentDialogueDefinition,
  zWizContentDialogueEffects,
  zWizContentDialogueOption,
} from "@/lib/wiz/core/definition/npc/dialogue"
import { zWizRequirements } from "@/lib/wiz/core/types"

describe("conversation numeric schemas", () => {
  it.each([-1, 0, 0.5, Number.POSITIVE_INFINITY, Number.NaN])(
    "giveItems/takeItemsのquantity %s を拒否する",
    (quantity) => {
      expect(
        zWizContentDialogueEffects.safeParse({
          giveItems: [{ itemId: "herb", quantity }],
        }).success,
      ).toBe(false)
      expect(
        zWizContentDialogueEffects.safeParse({
          takeItems: [{ itemId: "herb", quantity }],
        }).success,
      ).toBe(false)
    },
  )

  it.each([-1, 0, 0.5, Number.POSITIVE_INFINITY, Number.NaN])(
    "requiredItemsのquantity %s を拒否する",
    (quantity) => {
      expect(
        zWizRequirements.safeParse({
          requiredItems: [{ itemId: "pass", quantity }],
        }).success,
      ).toBe(false)
    },
  )

  it("levelはfinite non-negative integer、affinityはfiniteに制限する", () => {
    expect(zWizRequirements.safeParse({ minLevel: 0, maxLevel: 3 }).success).toBe(true)
    expect(zWizRequirements.safeParse({ minLevel: 0.5 }).success).toBe(false)
    expect(zWizRequirements.safeParse({ maxLevel: Number.POSITIVE_INFINITY }).success).toBe(false)
    expect(zWizRequirements.safeParse({ minAffinity: Number.NaN }).success).toBe(false)
  })

  it("dialogueとoptionのaffinity数値はfiniteに制限する", () => {
    expect(
      zWizContentDialogue.safeParse({
        id: "invalid",
        minAffinity: Number.NaN,
        lines: [],
      }).success,
    ).toBe(false)
    expect(
      zWizContentDialogueOption.safeParse({
        id: "invalid",
        text: "invalid",
        affinityChange: Number.POSITIVE_INFINITY,
      }).success,
    ).toBe(false)
    expect(
      zWizContentDialogueEffects.safeParse({
        affinityChange: Number.NEGATIVE_INFINITY,
      }).success,
    ).toBe(false)
  })
})

describe("conversation strict schemas", () => {
  it("完全形式と簡易形式の未宣言 field を拒否する", () => {
    expect(
      zWizContentDialogueDefinition.safeParse({
        id: "full",
        lines: [{ speaker: "npc", text: "hello", retiredPortraitId: "old" }],
      }).success,
    ).toBe(false)
    expect(
      zWizContentDialogueDefinition.safeParse({
        id: "short",
        minAffinity: 0,
        lines: ["hello"],
        retiredTrigger: "old",
      }).success,
    ).toBe(false)
  })

  it("完全形式と簡易形式を混在させた定義を拒否する", () => {
    expect(
      zWizContentDialogueDefinition.safeParse({
        id: "mixed",
        minAffinity: 0,
        lines: ["hello"],
        triggers: { afterQuest: "quest" },
      }).success,
    ).toBe(false)
  })

  it("nested effect entry の未宣言 field を拒否する", () => {
    expect(
      zWizContentDialogueEffects.safeParse({
        giveItems: [{ itemId: "herb", quantity: 1, retiredQuantity: 2 }],
      }).success,
    ).toBe(false)
  })
})
