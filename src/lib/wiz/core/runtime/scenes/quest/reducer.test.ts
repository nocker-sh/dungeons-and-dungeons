import { describe, expect, it } from "vite-plus/test"
import {
  MOCK_CONTENT,
  MOCK_SHOP_DIALOGUE_SERVICE,
  MOCK_VAULT,
} from "@/lib/wiz/core/mocks/mock-vault"
import { createMockInventoryService, withMockInventory } from "@/lib/wiz/core/mocks/mock-inventory"
import { WizEngineQuestProgress } from "@/lib/wiz/core/engine/quest/progress"
import { WizSceneTransitionService } from "@/lib/wiz/core/runtime/scene-transition-service"
import { MOCK_BATTLE_AUTHORITIES } from "@/lib/wiz/core/mocks/mock-battle-authorities"
import { toQuestScene, toVillageScene } from "@/lib/wiz/core/runtime/scene-transitions"
import { WizSceneQuestReducer } from "@/lib/wiz/core/runtime/scenes/quest/reducer"

const inventoryService = createMockInventoryService(undefined, "quest-entry")
const reducer = new WizSceneQuestReducer({
  questProgressService: new WizEngineQuestProgress({ inventoryService }),
})
const transitionService = new WizSceneTransitionService({
  ...MOCK_BATTLE_AUTHORITIES,
  content: MOCK_CONTENT,
  shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
})
const reduce = (...args: Parameters<WizSceneQuestReducer["reduce"]>) =>
  transitionService.applyResult(reducer.reduce(...args)).state

describe("SELECT_QUEST", () => {
  it("クエストを選択できる", () => {
    const state = toQuestScene(MOCK_VAULT)
    const action = {
      type: "SELECT_QUEST" as const,
      questId: "quest_slime_hunt",
    }

    const result = reduce(state, action)

    expect(result.type).toBe("quest")
    if (result.type === "quest") {
      expect(result.selectedQuest).not.toBeNull()
      expect(result.selectedQuest?.id).toBe("quest_slime_hunt")
      expect(result.selectedQuest?.name).toBe("スライム退治")
    }
  })

  it("存在しないクエストIDの場合はnullになる", () => {
    const state = toQuestScene(MOCK_VAULT)
    const action = {
      type: "SELECT_QUEST" as const,
      questId: "nonexistent_quest",
    }

    const result = reduce(state, action)

    expect(result.type).toBe("quest")
    if (result.type === "quest") {
      expect(result.selectedQuest).toBeNull()
      expect(result.message).toEqual({
        type: "quest_selection_rejected",
        questId: "nonexistent_quest",
        reason: "quest_not_found",
      })
    }
  })

  it("選択を明示的に解除できる", () => {
    const selected = reduce(toQuestScene(MOCK_VAULT), {
      type: "SELECT_QUEST",
      questId: "quest_slime_hunt",
    })

    const result = reduce(selected, { type: "CLEAR_QUEST_SELECTION" })

    expect(result.type).toBe("quest")
    if (result.type === "quest") {
      expect(result.selectedQuest).toBeNull()
      expect(result.message).toBeNull()
    }
  })

  it("quest以外のフェーズでは状態が変わらない", () => {
    const villageState = toVillageScene(MOCK_VAULT)
    const action = {
      type: "SELECT_QUEST" as const,
      questId: "quest_slime_hunt",
    }

    const result = reduce(villageState as never, action)

    expect(result as never).toBe(villageState as never)
  })
})

describe("ACCEPT_QUEST", () => {
  it("選択したクエストを受諾できる", () => {
    const state = toQuestScene(MOCK_VAULT)
    const stateWithSelected = reduce(state, {
      type: "SELECT_QUEST",
      questId: "quest_slime_hunt",
    })

    const result = reduce(stateWithSelected, { type: "ACCEPT_QUEST" })

    expect(result.type).toBe("quest")
    if (result.type === "quest") {
      const quest = result.vault.quests.find((q) => q.id === "quest_slime_hunt")
      expect(quest?.accepted).toBe(true)
      expect(result.message).toEqual({
        type: "quest_accepted",
        questId: "quest_slime_hunt",
      })
    }
  })

  it("クエスト未選択の場合はsemantic reasonを返す", () => {
    const state = toQuestScene(MOCK_VAULT)

    const result = reduce(state, { type: "ACCEPT_QUEST" })

    expect(result.type).toBe("quest")
    if (result.type === "quest") {
      expect(result.message).toEqual({
        type: "quest_acceptance_rejected",
        reason: "no_selection",
      })
    }
  })

  it("受注済みクエストはsemantic reason付きで拒否する", () => {
    const vault = MOCK_VAULT.updateQuest("quest_slime_hunt", (quest) => ({
      ...quest,
      accepted: true,
    }))
    const selected = reduce(toQuestScene(vault), {
      type: "SELECT_QUEST",
      questId: "quest_slime_hunt",
    })

    const result = reduce(selected, { type: "ACCEPT_QUEST" })

    expect(result.type).toBe("quest")
    if (result.type === "quest") {
      expect(result.message).toEqual({
        type: "quest_acceptance_rejected",
        questId: "quest_slime_hunt",
        reason: "already_accepted",
      })
    }
  })

  it("quest以外のフェーズでは状態が変わらない", () => {
    const villageState = toVillageScene(MOCK_VAULT)

    const result = reduce(villageState as never, {
      type: "ACCEPT_QUEST",
    })

    expect(result as never).toBe(villageState as never)
  })
})

describe("COMPLETE_QUEST", () => {
  describe("完了条件を満たす場合", () => {
    it("defeatクエストを完了できる", () => {
      // quest_slime_hunt: slime 3体討伐
      const vaultWithProgress = MOCK_VAULT.updateQuest("quest_slime_hunt", (q) => ({
        ...q,
        accepted: true,
        objective: { ...q.objective, current: 3 },
      }))
      const state = toQuestScene(vaultWithProgress)
      const stateWithSelected = reduce(state, {
        type: "SELECT_QUEST",
        questId: "quest_slime_hunt",
      })

      const result = reduce(stateWithSelected, {
        type: "COMPLETE_QUEST",
      })

      expect(result.type).toBe("quest")
      if (result.type === "quest") {
        const quest = result.vault.quests.find((q) => q.id === "quest_slime_hunt")
        expect(quest?.completed).toBe(true)
        expect(result.message).toEqual({
          type: "quest_completed",
          questId: "quest_slime_hunt",
          reward: {
            gold: 50,
            exp: 30,
            affinityBonus: 5,
          },
        })
      }
    })

    it("gatherクエストを完了できる (インベントリからアイテム消費)", () => {
      // quest_herb_gather: herb 5個収集
      const vaultWithItems = withMockInventory(
        MOCK_VAULT.updateQuest("quest_herb_gather", (q) => ({
          ...q,
          accepted: true,
        })),
        [{ contentType: "item", contentId: "herb", quantity: 5 }],
      )

      const state = toQuestScene(vaultWithItems)
      const stateWithSelected = reduce(state, {
        type: "SELECT_QUEST",
        questId: "quest_herb_gather",
      })

      const result = reduce(stateWithSelected, {
        type: "COMPLETE_QUEST",
      })

      expect(result.type).toBe("quest")
      if (result.type === "quest") {
        const quest = result.vault.quests.find((q) => q.id === "quest_herb_gather")
        expect(quest?.completed).toBe(true)
        expect(result.vault.inventory.totalQuantity("item", "herb")).toBe(0)
        expect(result.message).toEqual({
          type: "quest_completed",
          questId: "quest_herb_gather",
          reward: {
            gold: 30,
            exp: 20,
            affinityBonus: 3,
          },
        })
      }
    })

    it("exploreクエストを完了できる", () => {
      // quest_explore_forest: forest 50%探索
      // Lv2にしてクエスト報酬50EXPでレベルアップしないようにする
      const vaultWithProgress = MOCK_VAULT.updatePlayer((p) => p.levelUp(p.maxHp, 100))
        .updateQuest("quest_explore_forest", (q) => ({
          ...q,
          accepted: true,
        }))
        .updateArea("forest", (a) => ({
          ...a,
          progress: 50,
        }))

      const state = toQuestScene(vaultWithProgress)
      const stateWithSelected = reduce(state, {
        type: "SELECT_QUEST",
        questId: "quest_explore_forest",
      })

      const result = reduce(stateWithSelected, {
        type: "COMPLETE_QUEST",
      })

      expect(result.type).toBe("quest")
      if (result.type === "quest") {
        const quest = result.vault.quests.find((q) => q.id === "quest_explore_forest")
        expect(quest?.completed).toBe(true)
        expect(result.message).toEqual({
          type: "quest_completed",
          questId: "quest_explore_forest",
          reward: {
            gold: 100,
            exp: 50,
            affinityBonus: 10,
          },
        })
      }
    })

    it("報酬でゴールドと経験値が増加する", () => {
      const initialGold = MOCK_VAULT.player.gold
      const initialExp = MOCK_VAULT.player.exp

      const vaultWithProgress = MOCK_VAULT.updateQuest("quest_slime_hunt", (q) => ({
        ...q,
        accepted: true,
        objective: { ...q.objective, current: 3 },
      }))
      const state = toQuestScene(vaultWithProgress)
      const stateWithSelected = reduce(state, {
        type: "SELECT_QUEST",
        questId: "quest_slime_hunt",
      })

      const result = reduce(stateWithSelected, {
        type: "COMPLETE_QUEST",
      })

      expect(result.type).toBe("quest")
      if (result.type === "quest") {
        expect(result.vault.player.gold).toBe(initialGold + 50)
        expect(result.vault.player.exp).toBe(initialExp + 30)
      }
    })

    it("NPCの親密度が上昇する", () => {
      const vaultWithProgress = MOCK_VAULT.updateQuest("quest_slime_hunt", (q) => ({
        ...q,
        accepted: true,
        objective: { ...q.objective, current: 3 },
      }))
      const initialAffinity = vaultWithProgress.npcs.find((n) => n.id === "elda")?.affinity ?? 0

      const state = toQuestScene(vaultWithProgress)
      const stateWithSelected = reduce(state, {
        type: "SELECT_QUEST",
        questId: "quest_slime_hunt",
      })

      const result = reduce(stateWithSelected, {
        type: "COMPLETE_QUEST",
      })

      expect(result.type).toBe("quest")
      if (result.type === "quest") {
        const npc = result.vault.npcs.find((n) => n.id === "elda")
        expect(npc?.affinity).toBe(initialAffinity + 5)
      }
    })

    it("ゲームログにQUEST_COMPLETEDが記録される", () => {
      const vaultWithProgress = MOCK_VAULT.updateQuest("quest_slime_hunt", (q) => ({
        ...q,
        accepted: true,
        objective: { ...q.objective, current: 3 },
      }))
      const state = toQuestScene(vaultWithProgress)
      const stateWithSelected = reduce(state, {
        type: "SELECT_QUEST",
        questId: "quest_slime_hunt",
      })

      const result = reduce(stateWithSelected, {
        type: "COMPLETE_QUEST",
      })

      expect(result.type).toBe("quest")
      if (result.type === "quest") {
        const log = result.vault.log
        const questLog = log.find((l) => l.key === "QUEST_COMPLETED")
        expect(questLog).toBeDefined()
        if (questLog && "questId" in questLog) {
          expect(questLog.questId).toBe("quest_slime_hunt")
        }
      }
    })
  })

  describe("完了条件を満たさない場合", () => {
    it("defeatクエストで討伐数が足りない場合は完了できない", () => {
      const vaultWithProgress = MOCK_VAULT.updateQuest("quest_slime_hunt", (q) => ({
        ...q,
        accepted: true,
        objective: { ...q.objective, current: 2 }, // 3体必要だが2体しか倒していない
      }))
      const state = toQuestScene(vaultWithProgress)
      const stateWithSelected = reduce(state, {
        type: "SELECT_QUEST",
        questId: "quest_slime_hunt",
      })

      const result = reduce(stateWithSelected, {
        type: "COMPLETE_QUEST",
      })

      expect(result.type).toBe("quest")
      if (result.type === "quest") {
        const quest = result.vault.quests.find((q) => q.id === "quest_slime_hunt")
        expect(quest?.completed).toBe(false)
        expect(result.message).toEqual({
          type: "quest_completion_rejected",
          rejection: {
            type: "objective_incomplete",
            questId: "quest_slime_hunt",
            objectiveType: "defeat",
            targetId: "slime",
            current: 2,
            required: 3,
          },
        })
      }
    })

    it("gatherクエストでアイテム数が足りない場合は完了できない", () => {
      const vaultWithItems = withMockInventory(
        MOCK_VAULT.updateQuest("quest_herb_gather", (q) => ({
          ...q,
          accepted: true,
        })),
        [{ contentType: "item", contentId: "herb", quantity: 3 }],
      ) // 5個必要だが3個しかない

      const state = toQuestScene(vaultWithItems)
      const stateWithSelected = reduce(state, {
        type: "SELECT_QUEST",
        questId: "quest_herb_gather",
      })

      const result = reduce(stateWithSelected, {
        type: "COMPLETE_QUEST",
      })

      expect(result.type).toBe("quest")
      if (result.type === "quest") {
        const quest = result.vault.quests.find((q) => q.id === "quest_herb_gather")
        expect(quest?.completed).toBe(false)
        expect(result.message).toEqual({
          type: "quest_completion_rejected",
          rejection: {
            type: "objective_incomplete",
            questId: "quest_herb_gather",
            objectiveType: "gather",
            targetId: "herb",
            current: 3,
            required: 5,
          },
        })
      }
    })

    it("exploreクエストで探索度が足りない場合は完了できない", () => {
      const vaultWithProgress = MOCK_VAULT.updateQuest("quest_explore_forest", (q) => ({
        ...q,
        accepted: true,
      })).updateArea("forest", (a) => ({
        ...a,
        progress: 30, // 50%必要だが30%しか探索していない
      }))

      const state = toQuestScene(vaultWithProgress)
      const stateWithSelected = reduce(state, {
        type: "SELECT_QUEST",
        questId: "quest_explore_forest",
      })

      const result = reduce(stateWithSelected, {
        type: "COMPLETE_QUEST",
      })

      expect(result.type).toBe("quest")
      if (result.type === "quest") {
        const quest = result.vault.quests.find((q) => q.id === "quest_explore_forest")
        expect(quest?.completed).toBe(false)
        expect(result.message).toEqual({
          type: "quest_completion_rejected",
          rejection: {
            type: "objective_incomplete",
            questId: "quest_explore_forest",
            objectiveType: "explore",
            targetId: "forest",
            current: 30,
            required: 50,
          },
        })
      }
    })

    it("クエストを受諾していない場合は完了できない", () => {
      const state = toQuestScene(MOCK_VAULT)
      const stateWithSelected = reduce(state, {
        type: "SELECT_QUEST",
        questId: "quest_slime_hunt",
      })

      const result = reduce(stateWithSelected, {
        type: "COMPLETE_QUEST",
      })

      expect(result.type).toBe("quest")
      if (result.type === "quest") {
        expect(result.message).toEqual({
          type: "quest_completion_rejected",
          rejection: {
            type: "quest_not_accepted",
            questId: "quest_slime_hunt",
          },
        })
      }
    })
  })

  it("クエスト未選択の場合はsemantic reasonを返す", () => {
    const state = toQuestScene(MOCK_VAULT)

    const result = reduce(state, { type: "COMPLETE_QUEST" })

    expect(result.type).toBe("quest")
    if (result.type === "quest") {
      expect(result.message).toEqual({
        type: "quest_completion_rejected",
        rejection: {
          type: "no_selection",
        },
      })
    }
  })

  it("quest以外のフェーズでは状態が変わらない", () => {
    const villageState = toVillageScene(MOCK_VAULT)

    const result = reduce(villageState as never, {
      type: "COMPLETE_QUEST",
    })

    expect(result as never).toBe(villageState as never)
  })
})

describe("LEAVE_QUEST", () => {
  it("クエストボードを離れてvillageフェーズに戻る", () => {
    const state = toQuestScene(MOCK_VAULT)

    const result = reduce(state, { type: "LEAVE_QUEST" })

    expect(result.type).toBe("village")
  })

  it("クエストを選択中でもvillageフェーズに戻れる", () => {
    const state = toQuestScene(MOCK_VAULT)
    const stateWithSelected = reduce(state, {
      type: "SELECT_QUEST",
      questId: "quest_slime_hunt",
    })

    const result = reduce(stateWithSelected, { type: "LEAVE_QUEST" })

    expect(result.type).toBe("village")
  })

  it("quest以外のフェーズでは状態が変わらない", () => {
    const villageState = toVillageScene(MOCK_VAULT)

    const result = reduce(villageState as never, { type: "LEAVE_QUEST" })

    expect(result as never).toBe(villageState as never)
  })
})

describe("不明なアクション", () => {
  it("questフェーズで不明なアクションの場合は状態が変わらない", () => {
    const state = toQuestScene(MOCK_VAULT)

    const result = reduce(state, { type: "UNKNOWN_ACTION" } as never)

    expect(result).toBe(state)
  })
})
