import { describe, expect, it } from "vite-plus/test"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WizStateGift } from "@/lib/wiz/core/domain/values/gift"
import { WizConversationAffinitySystem } from "@/lib/wiz/core/engine/conversation/create-wiz-standard-conversation-affinity-system"
import { WizEngineConversation } from "@/lib/wiz/core/engine/conversation"
import { createMockInventoryService } from "@/lib/wiz/core/mocks/create-mock-inventory-service"
import { withMockInventory } from "@/lib/wiz/core/mocks/with-mock-inventory"

const inventoryService = createMockInventoryService()
const service = new WizEngineConversation({ inventoryService })

describe("completeDialogue", () => {
  it("content assetsなしで最小構築できる", () => {
    const minimalService = new WizEngineConversation({ inventoryService })
    const npcId = MOCK_VAULT.npcs[0]?.id
    if (!npcId) throw new Error("NPC is required")

    expect(
      minimalService.completeDialogueResult(MOCK_VAULT, npcId).applied
    ).toBe(true)
  })

  it("injected configをdefensive copyする", () => {
    const config = {
      dialogueAffinityBonus: 2,
    }
    const configuredService = new WizEngineConversation({
      config,
      inventoryService,
    })
    const npcId = MOCK_VAULT.npcs[0]?.id
    if (!npcId) throw new Error("NPC is required")
    const before = MOCK_VAULT.findNpc(npcId)?.affinity ?? 0

    config.dialogueAffinityBonus = 99
    const result = configuredService.completeDialogueResult(MOCK_VAULT, npcId)

    expect(result.vault.findNpc(npcId)?.affinity).toBe(before + 2)
  })

  it("semantic resultに完了理由と実変化量を返す", () => {
    const npcId = MOCK_VAULT.npcs[0]?.id
    if (!npcId) throw new Error("NPC is required")

    const result = service.completeDialogueResult(MOCK_VAULT, npcId)

    expect(result.applied).toBe(true)
    if (!result.applied) return
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({
      type: "dialogue_completed",
      npcId,
      affinityChange: {
        reason: { type: "dialogue_completed" },
      },
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.events)).toBe(true)
  })

  it("存在しないNPCをtyped rejectionで返す", () => {
    const result = service.completeDialogueResult(MOCK_VAULT, "missing")

    expect(result).toEqual({
      applied: false,
      vault: MOCK_VAULT,
      rejection: { type: "npc_not_found", npcId: "missing" },
    })
  })

  it("会話完了で好感度が上がる", () => {
    const vault = MOCK_VAULT
    const npcId = vault.npcs[0]?.id

    if (npcId) {
      const initialAffinity = vault.findNpc(npcId)?.affinity ?? 0
      const newVault = service.completeDialogueResult(vault, npcId).vault
      const newAffinity = newVault.findNpc(npcId)?.affinity ?? 0

      expect(newAffinity).toBeGreaterThan(initialAffinity)
    }
  })

  it("存在しないNPCの場合は変更なし", () => {
    const vault = MOCK_VAULT

    const newVault = service.completeDialogueResult(
      vault,
      "non-existent-npc"
    ).vault

    expect(newVault.npcs).toEqual(vault.npcs)
  })

  it("注入したaffinity systemの上限を使う", () => {
    const npcId = MOCK_VAULT.npcs[0]?.id
    if (!npcId) throw new Error("NPC is required")
    const boundedService = new WizEngineConversation({
      config: {
        dialogueAffinityBonus: 999,
      },
      affinitySystem: new WizConversationAffinitySystem({
        minimum: 10,
        maximum: 25,
        levels: [{ id: "bounded", minimum: 10 }],
      }),
      inventoryService,
    })

    const result = boundedService.completeDialogueResult(
      MOCK_VAULT,
      npcId
    ).vault

    expect(result.findNpc(npcId)?.affinity).toBe(25)
  })
})

describe("applyGift", () => {
  it("semantic resultに贈り物ID・反応・理由を返す", () => {
    const npcId = MOCK_VAULT.npcs[0]?.id
    if (!npcId) throw new Error("NPC is required")
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb" },
    ])

    const result = service.applyGiftResult(
      vault,
      npcId,
      WizStateGift.create("herb")
    )

    expect(result.applied).toBe(true)
    if (!result.applied) return
    expect(result.events[0]).toMatchObject({
      type: "gift_applied",
      npcId,
      itemId: "herb",
      reaction: "love",
      affinityChange: {
        reason: { type: "gift_received", itemId: "herb" },
      },
    })
  })

  it("未所持アイテムをtyped rejectionで返す", () => {
    const npcId = MOCK_VAULT.npcs[0]?.id
    if (!npcId) throw new Error("NPC is required")

    const result = service.applyGiftResult(
      MOCK_VAULT,
      npcId,
      WizStateGift.create("missing")
    )

    expect(result).toEqual({
      applied: false,
      vault: MOCK_VAULT,
      rejection: { type: "item_not_owned", itemId: "missing" },
    })
  })

  it("プレゼントでアイテムが消費される", () => {
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb" },
    ])
    const npcId = vault.npcs[0]?.id

    if (npcId) {
      const gift = WizStateGift.create("herb")
      const newVault = service.applyGiftResult(vault, npcId, gift).vault

      expect(newVault.inventory.totalQuantity("item", "herb") > 0).toBe(false)
    }
  })

  it("NPC contentのボーナスで好感度を変える", () => {
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb" },
    ])
    const npcId = vault.npcs[0]?.id

    if (npcId) {
      const initialAffinity = vault.findNpc(npcId)?.affinity ?? 0
      const gift = WizStateGift.create("herb")
      const newVault = service.applyGiftResult(vault, npcId, gift).vault
      const newAffinity = newVault.findNpc(npcId)?.affinity ?? 0

      expect(newAffinity).toBe(initialAffinity + 10)
    }
  })

  it("configured bonusとreactionをeventに返す", () => {
    const npcId = MOCK_VAULT.npcs[0]?.id
    if (!npcId) throw new Error("NPC is required")
    const vault = withMockInventory(
      MOCK_VAULT.withNpcs(
        MOCK_VAULT.npcs.map((npc) =>
          npc.id === npcId
            ? {
                ...npc,
                giftPreferences: {
                  likes: ["herb"],
                  dislikes: [],
                  likeBonus: 17,
                },
              }
            : npc
        )
      ),
      [{ contentType: "item", contentId: "herb" }]
    )

    const result = service.applyGiftResult(
      vault,
      npcId,
      WizStateGift.create("herb")
    )

    expect(result.applied).toBe(true)
    if (!result.applied) return
    expect(result.vault.findNpc(npcId)?.affinity).toBe(17)
    expect(result.events[0]).toMatchObject({
      type: "gift_applied",
      reaction: "love",
      affinityBonus: 17,
      affinityChange: { change: 17 },
    })
  })

  it("dislikeの既定値-5を適用する", () => {
    const npcId = MOCK_VAULT.npcs[0]?.id
    if (!npcId) throw new Error("NPC is required")
    const vault = withMockInventory(
      MOCK_VAULT.withNpcs(
        MOCK_VAULT.npcs.map((npc) =>
          npc.id === npcId
            ? {
                ...npc,
                affinity: 10,
                giftPreferences: { likes: [], dislikes: ["herb"] },
              }
            : npc
        )
      ),
      [{ contentType: "item", contentId: "herb" }]
    )

    const result = service.applyGiftResult(
      vault,
      npcId,
      WizStateGift.create("herb")
    )

    expect(result.applied).toBe(true)
    if (!result.applied) return
    expect(result.vault.findNpc(npcId)?.affinity).toBe(5)
    expect(result.events[0]).toMatchObject({
      type: "gift_applied",
      reaction: "dislike",
      affinityBonus: -5,
    })
  })

  it("アイテムを持っていない場合は変更なし", () => {
    const vault = MOCK_VAULT
    const npcId = vault.npcs[0]?.id

    if (npcId) {
      const gift = WizStateGift.create("rare_gem")
      const newVault = service.applyGiftResult(vault, npcId, gift).vault

      expect(newVault.inventory).toEqual(vault.inventory)
      expect(newVault.findNpc(npcId)?.affinity).toBe(
        vault.findNpc(npcId)?.affinity
      )
    }
  })

  it("存在しないNPCの場合は変更なし", () => {
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb" },
    ])
    const gift = WizStateGift.create("herb")

    const newVault = service.applyGiftResult(
      vault,
      "non-existent-npc",
      gift
    ).vault

    expect(newVault.npcs).toEqual(vault.npcs)
    // アイテムも消費されない
    expect(newVault.inventory.totalQuantity("item", "herb") > 0).toBe(true)
  })
})

describe("WizStateGift.create", () => {
  it("ギフト確認を作成できる", () => {
    const gift = WizStateGift.create("flower")

    expect(gift.itemId).toBe("flower")
  })
})

describe("WizStateGift semantic events", () => {
  it("表示文を含まない贈答イベントを返す", () => {
    const gift = WizStateGift.create("flower")

    expect(gift.presentationEvent).toEqual({
      type: "gift_presented",
      itemId: "flower",
    })
  })
})

describe("WizStateGift toPlain / fromPlain", () => {
  it("プレーンオブジェクトとの相互変換", () => {
    const gift = WizStateGift.create("flower")
    const plain = gift.toPlain()
    const restored = WizStateGift.fromPlain(plain)

    expect(restored.itemId).toBe("flower")
    expect(plain).toEqual({ itemId: "flower" })
  })
})
