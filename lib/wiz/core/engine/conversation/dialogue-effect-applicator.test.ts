import { describe, expect, it } from "vite-plus/test"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import type { WizContentDialogueEffects } from "@/lib/wiz/core/definition/npc/dialogue"
import { WizConversationAffinitySystem } from "@/lib/wiz/core/engine/conversation/create-wiz-standard-conversation-affinity-system"
import { createWizConversationDialogueUnlockFlag } from "@/lib/wiz/core/engine/conversation/dialogue-selector"
import { WizEngineDialogueEffectApplicator } from "@/lib/wiz/core/engine/conversation/dialogue-effect-applicator"
import { createMockInventoryService } from "@/lib/wiz/core/mocks/create-mock-inventory-service"
import { withMockInventory } from "@/lib/wiz/core/mocks/with-mock-inventory"

const inventoryService = createMockInventoryService()
const applicator = new WizEngineDialogueEffectApplicator({ inventoryService })
const npcId = "elda"

describe("WizEngineDialogueEffectApplicator", () => {
  it("affinityChange で好感度を増減する", () => {
    const effects: WizContentDialogueEffects = { affinityChange: 10 }
    const npc = MOCK_VAULT.findNpc(npcId)
    const result = applicator.apply(MOCK_VAULT, npcId, effects)
    const updatedNpc = result.findNpc(npcId)

    expect(updatedNpc?.affinity).toBe((npc?.affinity ?? 0) + 10)
  })

  it("affinityChange は 0-100 にクランプされる", () => {
    const effects: WizContentDialogueEffects = { affinityChange: 999 }
    const result = applicator.apply(MOCK_VAULT, npcId, effects)
    const updatedNpc = result.findNpc(npcId)

    expect(updatedNpc?.affinity).toBe(100)
  })

  it("注入したaffinity systemの範囲でクランプする", () => {
    const boundedApplicator = new WizEngineDialogueEffectApplicator({
      affinitySystem: new WizConversationAffinitySystem({
        minimum: 10,
        maximum: 25,
        levels: [{ id: "bounded", minimum: 10 }],
      }),
      inventoryService,
    })
    const highResult = boundedApplicator.apply(MOCK_VAULT, npcId, {
      affinityChange: 999,
    })
    const lowResult = boundedApplicator.apply(MOCK_VAULT, npcId, {
      affinityChange: -999,
    })

    expect(highResult.findNpc(npcId)?.affinity).toBe(25)
    expect(lowResult.findNpc(npcId)?.affinity).toBe(10)
  })

  it("giveItems でアイテムを付与する", () => {
    const effects: WizContentDialogueEffects = {
      giveItems: [{ itemId: "herb", quantity: 3 }],
    }
    const result = applicator.apply(MOCK_VAULT, npcId, effects)

    expect(result.inventory.totalQuantity("item", "herb")).toBe(3)
  })

  it("takeItems でアイテムを消費する", () => {
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "letter", quantity: 2 },
    ])
    const effects: WizContentDialogueEffects = {
      takeItems: [{ itemId: "letter", quantity: 1 }],
    }
    const result = applicator.apply(vault, npcId, effects)

    expect(result.inventory.totalQuantity("item", "letter")).toBe(1)
  })

  it("takeItemsの合計所持数が不足する場合は全effectsを原子的に適用しない", () => {
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "letter" },
    ])
    const result = applicator.apply(vault, npcId, {
      takeItems: [
        { itemId: "letter", quantity: 1 },
        { itemId: "letter", quantity: 1 },
      ],
      giveItems: [{ itemId: "herb", quantity: 1 }],
      setFlags: ["should_not_be_set"],
    })

    expect(result).toBe(vault)
    expect(result.inventory.totalQuantity("item", "letter")).toBe(1)
    expect(result.inventory.totalQuantity("item", "herb") > 0).toBe(false)
    expect(result.hasFlag("should_not_be_set")).toBe(false)
  })

  it("setFlags でフラグを追加する", () => {
    const effects: WizContentDialogueEffects = {
      setFlags: ["talked_to_elder", "quest_hint"],
    }
    const result = applicator.apply(MOCK_VAULT, npcId, effects)

    expect(result.hasFlag("talked_to_elder")).toBe(true)
    expect(result.hasFlag("quest_hint")).toBe(true)
  })

  it("removeFlags でフラグを削除する", () => {
    const vault = MOCK_VAULT.addFlag("temp_flag")
    const effects: WizContentDialogueEffects = {
      removeFlags: ["temp_flag"],
    }
    const result = applicator.apply(vault, npcId, effects)

    expect(result.hasFlag("temp_flag")).toBe(false)
  })

  it("startQuest でクエストを受注する", () => {
    const questId = MOCK_VAULT.quests[0]?.id
    if (!questId) return

    const effects: WizContentDialogueEffects = { startQuest: questId }
    const result = applicator.apply(MOCK_VAULT, npcId, effects)
    const quest = result.findQuest(questId)

    expect(quest?.accepted).toBe(true)
  })

  it("completeQuest でクエストを完了する", () => {
    const questId = MOCK_VAULT.quests[0]?.id
    if (!questId) return

    const effects: WizContentDialogueEffects = { completeQuest: questId }
    const result = applicator.apply(MOCK_VAULT, npcId, effects)
    const quest = result.findQuest(questId)

    expect(quest?.completed).toBe(true)
  })

  it("unlockDialogue をNPCごとに衝突しないinternal receiptへ変換する", () => {
    const result = applicator.apply(MOCK_VAULT, npcId, {
      unlockDialogue: "secret:ending",
    })

    expect(
      result.hasFlag(
        createWizConversationDialogueUnlockFlag(npcId, "secret:ending")
      )
    ).toBe(true)
    expect(
      result.hasFlag(
        createWizConversationDialogueUnlockFlag("elda:secret", "ending")
      )
    ).toBe(false)
  })

  it("複数の効果を同時に適用できる", () => {
    const questId = MOCK_VAULT.quests[0]?.id
    if (!questId) return

    const effects: WizContentDialogueEffects = {
      affinityChange: 5,
      giveItems: [{ itemId: "herb", quantity: 1 }],
      setFlags: ["special_event"],
      startQuest: questId,
    }
    const npc = MOCK_VAULT.findNpc(npcId)
    const result = applicator.apply(MOCK_VAULT, npcId, effects)

    expect(result.findNpc(npcId)?.affinity).toBe((npc?.affinity ?? 0) + 5)
    expect(result.inventory.totalQuantity("item", "herb")).toBe(1)
    expect(result.hasFlag("special_event")).toBe(true)
    expect(result.findQuest(questId)?.accepted).toBe(true)
  })

  it("空の effects では何も変わらない", () => {
    const effects: WizContentDialogueEffects = {}
    const result = applicator.apply(MOCK_VAULT, npcId, effects)

    expect(result.toPlain()).toEqual(MOCK_VAULT.toPlain())
  })
})
