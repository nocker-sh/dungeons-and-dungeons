import { describe, expect, it } from "vite-plus/test"
import type { WizContentRecipe } from "@/lib/wiz/core/definition/recipe/recipe"
import type { WizVaultQuestState } from "@/lib/wiz/core/vault/states/quest/schema"
import { WizEngineBattleEncounter } from "@/lib/wiz/core/engine/battle/phases/encounter"
import { wizMockEasyBattle } from "@/lib/wiz/core/mocks/wiz-mock-easy-battle"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WizStateBattle } from "@/lib/wiz/core/runtime/scenes/battle/state"
import type { WizCraftingResultState } from "@/lib/wiz/core/domain/values/crafting-result"
import {
  WizConversationProgress,
  WizStateConversation,
} from "@/lib/wiz/core/runtime/scenes/conversation/state"
import { presentWizConversationTranscript } from "@/lib/wiz/core/runtime/scenes/conversation/present-wiz-conversation-transcript"
import type { WizConversationTranscriptEntry } from "@/lib/wiz/core/runtime/scenes/conversation/types"
import { WizStateCrafting } from "@/lib/wiz/core/runtime/scenes/crafting/state"
import {
  WizStateExploration,
  type WizSceneExplorationEventProgress,
} from "@/lib/wiz/core/runtime/scenes/exploration/states/state"
import { WizStateInn } from "@/lib/wiz/core/runtime/scenes/inn/state"
import { WizStateLevelUp } from "@/lib/wiz/core/runtime/scenes/level-up/state"
import { WizStateQuest } from "@/lib/wiz/core/runtime/scenes/quest/state"
import {
  WizStateShop,
  type WizSceneShopConversation,
  type WizSceneShopPurchaseConfirmation,
} from "@/lib/wiz/core/runtime/scenes/shop/state"
import { WizStateVillage } from "@/lib/wiz/core/runtime/scenes/village/state"
import { WizVaultValue } from "@/lib/wiz/core/vault/value"

describe("runtime scene state immutable ownership", () => {
  it("outer propertiesを所有し、immutable classのidentityとprototypeを維持する", () => {
    const phase = wizMockEasyBattle()
    const battleProperties: ConstructorParameters<typeof WizStateBattle>[0] = {
      type: "battle",
      phase,
      returnAreaId: "forest",
      vault: MOCK_VAULT,
    }
    const villageProperties: ConstructorParameters<typeof WizStateVillage>[0] =
      {
        type: "village",
        selectedAction: null,
        vault: MOCK_VAULT,
      }
    const innProperties: ConstructorParameters<typeof WizStateInn>[0] = {
      type: "inn",
      selectedPlan: null,
      confirmingStay: false,
      message: null,
      vault: MOCK_VAULT,
    }
    const battleState = new WizStateBattle(battleProperties)
    const villageState = new WizStateVillage(villageProperties)
    const innState = new WizStateInn(innProperties)

    ;(battleProperties as { returnAreaId: string }).returnAreaId = "cave"
    ;(villageProperties as { selectedAction: "shop" | null }).selectedAction =
      "shop"
    ;(innProperties as { message: string | null }).message = "changed"

    expect(battleState.returnAreaId).toBe("forest")
    expect(villageState.selectedAction).toBeNull()
    expect(innState.message).toBeNull()
    expect(battleState.phase).toBe(phase)
    expect(battleState.phase).toBeInstanceOf(WizEngineBattleEncounter)
    expect(battleState.vault).toBe(MOCK_VAULT)
    expect(battleState.vault).toBeInstanceOf(WizVaultValue)
  })

  it("conversationのsemantic transcriptを所有し、presentationを導出する", () => {
    const npc = MOCK_VAULT.npcs[0]
    const dialogue = npc?.dialogues[0]
    if (!npc || !dialogue) throw new Error("Conversation fixture is required")
    const transcript: WizConversationTranscriptEntry[] = [
      { type: "dialogue_line", dialogueId: dialogue.id, lineIndex: 0 },
      {
        type: "gift_applied",
        itemId: "herb",
        reaction: "love",
        affinityDelta: 2,
      },
    ]
    const state = new WizStateConversation({
      type: "conversation",
      npcId: npc.id,
      progress: WizConversationProgress.reading(dialogue.id, 1),
      transcript,
      pendingGiftItemId: "herb",
      vault: MOCK_VAULT,
    })

    ;(transcript[0] as { lineIndex: number }).lineIndex = 9
    ;(transcript[1] as { reaction: string }).reaction = "dislike"
    transcript.push({
      type: "gift_applied",
      itemId: "ore",
      reaction: "neutral",
      affinityDelta: 1,
    })

    expect(state.transcript).toEqual([
      { type: "dialogue_line", dialogueId: dialogue.id, lineIndex: 0 },
      {
        type: "gift_applied",
        itemId: "herb",
        reaction: "love",
        affinityDelta: 2,
      },
    ])
    const history = presentWizConversationTranscript(
      state.transcript,
      state.vault.findNpc(state.npcId)
    )
    expect(state.pendingGiftItemId).toBe("herb")
    expect(state.affinityGained).toBe(2)
    expect(history.slice(-2)).toEqual([
      { type: "gift_presented", itemId: "herb" },
      { type: "gift_reaction", reaction: "love" },
    ])
    expect(Object.isFrozen(state.transcript)).toBe(true)
    expect(Object.isFrozen(state.transcript[0])).toBe(true)
    expect(Object.isFrozen(history)).toBe(true)
    expect(Object.isFrozen(history[0])).toBe(true)
    expect(() => {
      ;(state.transcript[0] as { lineIndex: number }).lineIndex = 8
    }).toThrow()
  })

  it("completion receiptがactive dialogueの完了entryを指さない状態を拒否する", () => {
    const npc = MOCK_VAULT.npcs[0]
    const dialogue = npc?.dialogues[0]
    if (!npc || !dialogue) throw new Error("Conversation fixture is required")

    expect(
      () =>
        new WizStateConversation({
          type: "conversation",
          npcId: npc.id,
          progress: new WizConversationProgress({
            phase: "completed",
            dialogueId: dialogue.id,
            nextLineIndex: 1,
            completion: { transcriptIndex: 0 },
          }),
          transcript: [
            {
              type: "dialogue_completed",
              dialogueId: "different-dialogue",
              affinityDelta: 1,
            },
          ],
          pendingGiftItemId: null,
          vault: MOCK_VAULT,
        })
    ).toThrow(/active dialogue/)
  })

  it("craftingのrecipe・result・facility collectionsをdeep copyする", () => {
    const materials = [{ type: "item" as const, itemId: "herb", quantity: 1 }]
    const recipe = {
      id: "potion",
      name: "Potion",
      description: "Heals",
      materials,
      result: { type: "item" as const, itemId: "potion" },
      difficulty: 5,
    } satisfies WizContentRecipe
    const dice: [number, number] = [2, 5]
    const result = {
      status: "success" as const,
      quality: "normal" as const,
      diceResult: {
        dice,
        total: 7,
        modifier: 1,
        targetNumber: 5,
        success: true,
        critical: false,
        fumble: false,
      },
    } satisfies WizCraftingResultState
    const availableFacilities = ["alchemy"]
    const state = new WizStateCrafting({
      type: "crafting",
      selectedRecipe: recipe,
      confirmingCraft: false,
      result,
      message: null,
      vault: MOCK_VAULT,
      availableFacilities,
    })

    materials[0]!.quantity = 9
    recipe.result.itemId = "changed"
    dice[0] = 6
    availableFacilities.push("forge")

    expect(state.selectedRecipe?.materials[0]?.quantity).toBe(1)
    expect(state.selectedRecipe?.result).toEqual({
      type: "item",
      itemId: "potion",
    })
    expect(state.availableFacilities).toEqual(["alchemy"])
    const ownedRecipe = state.selectedRecipe
    const ownedResult = state.result
    if (!ownedRecipe || ownedResult.status !== "success") {
      throw new Error("owned recipe and success result are required")
    }
    expect(ownedResult.diceResult.dice).toEqual([2, 5])
    expect(Object.isFrozen(ownedRecipe)).toBe(true)
    expect(Object.isFrozen(ownedRecipe.materials)).toBe(true)
    expect(Object.isFrozen(ownedRecipe.result)).toBe(true)
    expect(Object.isFrozen(ownedResult.diceResult.dice)).toBe(true)
    expect(Object.isFrozen(state.availableFacilities)).toBe(true)
    expect(() => {
      ;(ownedRecipe.materials[0] as { quantity: number }).quantity = 5
    }).toThrow()
    expect(() => {
      ;(ownedResult.diceResult.dice as [number, number])[0] = 6
    }).toThrow()
    expect(() => {
      ;(state.availableFacilities as string[]).push("forge")
    }).toThrow()
  })

  it("explorationのevent progressを末端collectionまでdeep copyする", () => {
    const rewardItems = [{ itemId: "herb", quantity: 1 }]
    const choices = [
      {
        label: "Search",
        successText: "Found",
        failText: "Missed",
        successReward: { items: rewardItems },
      },
    ]
    const event = {
      id: "ruins",
      description: "Old ruins",
      choices,
    }
    const dice: [number, number] = [3, 4]
    const progress = {
      status: "result" as const,
      event,
      choiceIndex: 0,
      diceResult: {
        dice,
        total: 7,
        modifier: 0,
        targetNumber: 6,
        success: true,
        critical: false,
        fumble: false,
      },
      resultText: "Found",
    } satisfies WizSceneExplorationEventProgress
    const gatheredItemIds = ["herb"]
    const state = new WizStateExploration({
      type: "exploration",
      areaId: "field",
      eventProgress: progress,
      message: {
        type: "items_gathered",
        areaId: "field",
        itemIds: gatheredItemIds,
      },
      vault: MOCK_VAULT,
    })

    event.description = "Changed"
    choices[0]!.label = "Changed"
    rewardItems[0]!.quantity = 9
    dice[0] = 6
    gatheredItemIds[0] = "changed"

    const ownedProgress = state.eventProgress
    if (ownedProgress.status !== "result") {
      throw new Error("result progress is required")
    }
    expect(ownedProgress.event.description).toBe("Old ruins")
    expect(ownedProgress.event.choices[0]?.label).toBe("Search")
    expect(
      ownedProgress.event.choices[0]?.successReward?.items?.[0]?.quantity
    ).toBe(1)
    expect(ownedProgress.diceResult.dice).toEqual([3, 4])
    expect(Object.isFrozen(ownedProgress)).toBe(true)
    expect(Object.isFrozen(ownedProgress.event.choices)).toBe(true)
    expect(
      Object.isFrozen(ownedProgress.event.choices[0]?.successReward?.items)
    ).toBe(true)
    expect(Object.isFrozen(ownedProgress.diceResult.dice)).toBe(true)
    expect(state.message).toEqual({
      type: "items_gathered",
      areaId: "field",
      itemIds: ["herb"],
    })
    if (state.message?.type === "items_gathered") {
      expect(Object.isFrozen(state.message.itemIds)).toBe(true)
    }
    expect(() => {
      ;(ownedProgress.event.choices[0] as { label: string }).label =
        "getter mutation"
    }).toThrow()
    expect(() => {
      ;(ownedProgress.diceResult.dice as [number, number])[0] = 6
    }).toThrow()
  })

  it("level-upのpending attributesを所有し、関数型更新を維持する", () => {
    const pendingAttributes = { strength: 2 }
    const state = new WizStateLevelUp({
      type: "level_up",
      availablePoints: 3,
      pendingAttributes,
      returnAreaId: "field",
      vault: MOCK_VAULT,
    })

    pendingAttributes.strength = 9
    const next = state.addPendingAttribute("strength", 1)

    expect(state.pendingAttributes.strength).toBe(2)
    expect(next.pendingAttributes.strength).toBe(3)
    expect(Object.isFrozen(state.pendingAttributes)).toBe(true)
    expect(() => {
      ;(state.pendingAttributes as { strength: number }).strength = 10
    }).toThrow()
  })

  it("questのobjective・reward collectionsをdeep copyする", () => {
    const objective = {
      type: "gather" as const,
      itemId: "herb",
      count: 2,
      current: 1,
    }
    const rewardItems = [
      { type: "item", itemId: "potion", quantity: 1 },
    ] satisfies {
      type: "item"
      itemId: string
      quantity: number
    }[]
    const reward = { gold: 10, exp: 5, affinityBonus: 0, items: rewardItems }
    const selectedQuest = {
      id: "gather-herb",
      name: "Gather Herb",
      description: "Collect herbs",
      giverNpcId: "guide",
      objective,
      reward,
      completed: false,
      accepted: true,
    } satisfies WizVaultQuestState
    const completionReward = { gold: 10, exp: 5, affinityBonus: 1 }
    const state = new WizStateQuest({
      type: "quest",
      selectedQuest,
      message: {
        type: "quest_completed",
        questId: selectedQuest.id,
        reward: completionReward,
      },
      vault: MOCK_VAULT,
    })

    objective.current = 9
    reward.gold = 999
    rewardItems[0]!.quantity = 9
    completionReward.gold = 999

    const ownedQuest = state.selectedQuest
    if (!ownedQuest) throw new Error("owned quest is required")
    const ownedRewardItem = ownedQuest.reward.items?.[0]
    if (!ownedRewardItem) throw new Error("owned reward item is required")
    expect(ownedQuest.objective).toMatchObject({ current: 1 })
    expect(ownedQuest.reward.gold).toBe(10)
    expect(ownedRewardItem.quantity).toBe(1)
    expect(Object.isFrozen(ownedQuest)).toBe(true)
    expect(Object.isFrozen(ownedQuest.objective)).toBe(true)
    expect(Object.isFrozen(ownedQuest.reward.items)).toBe(true)
    expect(state.message).toEqual({
      type: "quest_completed",
      questId: selectedQuest.id,
      reward: { gold: 10, exp: 5, affinityBonus: 1 },
    })
    if (state.message?.type === "quest_completed") {
      expect(Object.isFrozen(state.message.reward)).toBe(true)
    }
    expect(() => {
      ;(ownedQuest.objective as { current: number }).current = 9
    }).toThrow()
    expect(() => {
      ;(ownedRewardItem as { quantity: number }).quantity = 9
    }).toThrow()
  })

  it("shopのpurchase・conversation collectionsをdeep copyし、内部aliasを維持する", () => {
    const line = { speaker: "Shopkeeper", text: "Welcome" }
    const lines = [line]
    const displayedLines = [line]
    const conversation = {
      topicId: "greeting",
      lines,
      currentIndex: 1,
      displayedLines,
    } satisfies WizSceneShopConversation
    const pendingPurchase = {
      type: "item" as const,
      itemId: "potion",
      price: 10,
    } satisfies WizSceneShopPurchaseConfirmation
    const state = new WizStateShop({
      type: "shop",
      shopId: "general",
      buyPriceModifier: 1,
      pendingPurchase,
      message: null,
      conversation,
      lastConversation: conversation,
      vault: MOCK_VAULT,
    })

    line.text = "Changed"
    lines.push({ speaker: "Shopkeeper", text: "Added" })
    conversation.currentIndex = 9
    pendingPurchase.price = 999

    const ownedPurchase = state.pendingPurchase
    const ownedConversation = state.conversation
    if (!ownedPurchase || !ownedConversation) {
      throw new Error("owned purchase and conversation are required")
    }
    expect(ownedPurchase.price).toBe(10)
    expect(ownedConversation.currentIndex).toBe(1)
    expect(ownedConversation.lines).toEqual([
      { speaker: "Shopkeeper", text: "Welcome" },
    ])
    expect(ownedConversation).toBe(state.lastConversation)
    expect(ownedConversation.lines[0]).toBe(ownedConversation.displayedLines[0])
    expect(Object.isFrozen(ownedPurchase)).toBe(true)
    expect(Object.isFrozen(ownedConversation)).toBe(true)
    expect(Object.isFrozen(ownedConversation.lines)).toBe(true)
    expect(Object.isFrozen(ownedConversation.lines[0])).toBe(true)
    expect(() => {
      ;(ownedPurchase as { price: number }).price = 999
    }).toThrow()
    expect(() => {
      ;(ownedConversation.lines[0] as { text: string }).text = "getter mutation"
    }).toThrow()
  })
})
