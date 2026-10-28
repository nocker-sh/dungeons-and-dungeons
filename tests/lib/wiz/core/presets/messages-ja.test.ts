import { describe, expect, it } from "vite-plus/test"
import {
  createMessageTemplates,
  DEFAULT_MESSAGES_JA,
} from "@/lib/wiz/core/presets/create-message-templates"
import { formatWizConversationHistoryEntryJa } from "@/lib/wiz/core/presets/format-wiz-conversation-history-entry-ja"
import { formatWizCraftingMessageJa } from "@/lib/wiz/core/presets/format-wiz-crafting-message-ja"
import { formatWizGiftReactionJa } from "@/lib/wiz/core/presets/format-wiz-gift-reaction-ja"
import {
  WIZ_AFFINITY_LEVEL_NAMES_JA,
  WIZ_FACILITY_NAMES_JA,
} from "@/lib/wiz/core/presets/messages-ja"

describe("DEFAULT_MESSAGES_JA", () => {
  it("semantic keyだけを持つ不変templateとして公開する", () => {
    expect(Object.isFrozen(DEFAULT_MESSAGES_JA)).toBe(true)
    expect(DEFAULT_MESSAGES_JA).toHaveProperty("WORLD_STARTED")
  })

  it("overrideもsourceを変更せず不変tableとして所有する", () => {
    const overrides = { WORLD_STARTED: () => "別の始まり" }
    const templates = createMessageTemplates(overrides)

    overrides.WORLD_STARTED = () => "変更済み"

    expect(templates.WORLD_STARTED()).toBe("別の始まり")
    expect(Object.isFrozen(templates)).toBe(true)
  })
})

describe("formatWizConversationHistoryEntryJa", () => {
  const options = {
    npcName: "エルダ",
    resolveItemName: (itemId: string) =>
      itemId === "flower" ? "花" : undefined,
  }

  it("semantic speaker tokenを日本語の表示名へ変換する", () => {
    expect(
      formatWizConversationHistoryEntryJa(
        { type: "content", speaker: "player", text: "こんにちは" },
        options
      )
    ).toEqual({ speaker: "あなた", text: "こんにちは" })
    expect(
      formatWizConversationHistoryEntryJa(
        { type: "content", speaker: "npc", text: "ようこそ" },
        options
      )
    ).toEqual({ speaker: "エルダ", text: "ようこそ" })
  })

  it("複数NPC向けにcontent speaker resolverを差し替えられる", () => {
    expect(
      formatWizConversationHistoryEntryJa(
        {
          type: "content",
          speaker: "npc",
          sourceSpeaker: "companion",
          text: "行こう",
        },
        {
          ...options,
          resolveNpcSpeakerName: (speaker) =>
            speaker === "companion" ? "ミナ" : undefined,
        }
      )
    ).toEqual({ speaker: "ミナ", text: "行こう" })
  })

  it("gift eventsを日本語presentationへ変換する", () => {
    expect(
      formatWizConversationHistoryEntryJa(
        { type: "gift_presented", itemId: "flower" },
        options
      )
    ).toEqual({ speaker: "あなた", text: "花をプレゼントした" })
    expect(
      formatWizConversationHistoryEntryJa(
        { type: "gift_reaction", reaction: "love" },
        options
      )
    ).toEqual({ speaker: "エルダ", text: "わあ、大好き! ありがとう!" })
  })
})

describe("formatWizGiftReactionJa", () => {
  it("reaction tokenだけを日本語へ変換する", () => {
    expect(formatWizGiftReactionJa("dislike")).toBe("うーん...これは...")
    expect(formatWizGiftReactionJa("neutral")).toBe("ありがとう。")
  })
})

describe("formatWizCraftingMessageJa", () => {
  const resolvers = {
    recipe: (recipeId: string) =>
      recipeId === "potion" ? "ポーション" : undefined,
  }

  it("semantic crafting eventを日本語presentationへ変換する", () => {
    expect(
      formatWizCraftingMessageJa(
        { type: "craft_succeeded", recipeId: "potion", quality: "high" },
        resolvers
      )
    ).toBe("ポーションの製作に成功! 会心の出来!")
    expect(
      formatWizCraftingMessageJa(
        { type: "craft_failed", recipeId: "potion", materialsLost: 1 },
        resolvers
      )
    ).toBe("製作に失敗した... 素材を失った")
  })

  it("typed rejection messageを日本語へ変換する", () => {
    expect(
      formatWizCraftingMessageJa(
        { type: "missing_facility", recipeId: "potion", facilityId: "alchemy" },
        resolvers
      )
    ).toBe("必要な施設がない...")
    expect(
      formatWizCraftingMessageJa(
        { type: "missing_materials", recipeId: "potion" },
        resolvers
      )
    ).toBe("素材が足りない...")
  })

  it("resolverなしでもID fallbackで整形できる", () => {
    expect(
      formatWizCraftingMessageJa({
        type: "craft_succeeded",
        recipeId: "unknown_recipe",
        quality: "normal",
      })
    ).toBe("unknown_recipeの製作に成功! ")
  })
})

describe("Japanese display-name maps", () => {
  it("affinity and facility IDs stay outside headless core", () => {
    expect(WIZ_AFFINITY_LEVEL_NAMES_JA.friend).toBe("友人")
    expect(WIZ_FACILITY_NAMES_JA.alchemy).toBe("錬金術室")
  })
})
