import { describe, expect, it } from "vite-plus/test"
import {
  MOCK_CONTENT,
  MOCK_SHOP_DIALOGUE_SERVICE,
  MOCK_VAULT,
} from "@/lib/wiz/core/mocks/mock-vault"
import { WizEngineInn } from "@/lib/wiz/core/engine/inn"
import { WizEngineInnPlanCatalog } from "@/lib/wiz/core/engine/inn/plan-catalog"
import { WizSceneTransitionService } from "@/lib/wiz/core/runtime/scene-transition-service"
import { MOCK_BATTLE_AUTHORITIES } from "@/lib/wiz/core/mocks/mock-battle-authorities"
import { toInnScene } from "@/lib/wiz/core/runtime/to-inn-scene"
import { toVillageScene } from "@/lib/wiz/core/runtime/to-village-scene"
import { WizSceneInnReducer } from "@/lib/wiz/core/runtime/scenes/inn/reducer"

const reducer = new WizSceneInnReducer({
  innService: new WizEngineInn(
    new WizEngineInnPlanCatalog(MOCK_CONTENT.arrays.innPlans)
  ),
})
const basicPlan = MOCK_CONTENT.getInnPlan("basic")
const deluxePlan = MOCK_CONTENT.getInnPlan("deluxe")
const transitionService = new WizSceneTransitionService({
  ...MOCK_BATTLE_AUTHORITIES,
  content: MOCK_CONTENT,
  shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
})
const reduce = (...args: Parameters<WizSceneInnReducer["reduce"]>) =>
  transitionService.applyResult(reducer.reduce(...args)).state

describe("SELECT_STAY_PLAN", () => {
  it("プランを選択できる", () => {
    const state = toInnScene(MOCK_VAULT)
    const action = { type: "SELECT_STAY_PLAN" as const, plan: "basic" as const }

    const result = reduce(state, action)

    expect(result.type).toBe("inn")
    if (result.type === "inn") {
      expect(result.selectedPlan).toBe("basic")
      expect(result.confirmingStay).toBe(true)
    }
  })

  it("ゴールド不足の場合はメッセージを表示する", () => {
    const vault = MOCK_VAULT.updatePlayer((p) => p.spendGold(p.gold))
    const state = toInnScene(vault)
    const action = {
      type: "SELECT_STAY_PLAN" as const,
      plan: "deluxe" as const,
    }

    const result = reduce(state, action)

    expect(result.type).toBe("inn")
    if (result.type === "inn") {
      expect(result.selectedPlan).toBe(null)
      expect(result.confirmingStay).toBe(false)
      expect(result.message).toEqual({
        type: "stay_rejected",
        rejection: {
          type: "insufficient_gold",
          planId: "deluxe",
          required: deluxePlan.price,
          available: 0,
          shortfall: deluxePlan.price,
        },
      })
    }
  })

  it("所持金がちょうど足りる場合は選択できる", () => {
    const basicPrice = basicPlan.price
    const vault = MOCK_VAULT.updatePlayer((p) =>
      p.spendGold(p.gold).addGold(basicPrice)
    )
    const state = toInnScene(vault)
    const action = { type: "SELECT_STAY_PLAN" as const, plan: "basic" as const }

    const result = reduce(state, action)

    expect(result.type).toBe("inn")
    if (result.type === "inn") {
      expect(result.selectedPlan).toBe("basic")
      expect(result.confirmingStay).toBe(true)
    }
  })

  it("inn以外のフェーズでは状態を変更しない", () => {
    const villageState = toVillageScene(MOCK_VAULT)
    const action = { type: "SELECT_STAY_PLAN" as const, plan: "basic" as const }

    const result = reduce(villageState as never, action)

    expect(result as never).toBe(villageState as never)
  })
})

describe("CONFIRM_STAY", () => {
  it("プラン選択後に宿泊を確定できる", () => {
    const state = toInnScene(MOCK_VAULT)
      .withSelectedPlan("basic")
      .withConfirmingStay(true)
    const action = { type: "CONFIRM_STAY" as const }

    const result = reduce(state, action)

    // 宿泊後は village フェーズに戻る
    expect(result.type).toBe("village")
  })

  it("宿泊確定後はゴールドが減る", () => {
    const initialGold = MOCK_VAULT.player.gold
    const state = toInnScene(MOCK_VAULT)
      .withSelectedPlan("basic")
      .withConfirmingStay(true)
    const action = { type: "CONFIRM_STAY" as const }

    const result = reduce(state, action)

    expect(result.vault.player.gold).toBe(initialGold - basicPlan.price)
  })

  it("確定時に資金不足なら確認状態を解除して理由を返す", () => {
    const vault = MOCK_VAULT.updatePlayer((player) =>
      player.spendGold(player.gold)
    )
    const state = toInnScene(vault)
      .withSelectedPlan("deluxe")
      .withConfirmingStay(true)

    const result = reduce(state, { type: "CONFIRM_STAY" })

    expect(result.type).toBe("inn")
    if (result.type === "inn") {
      expect(result.selectedPlan).toBeNull()
      expect(result.confirmingStay).toBe(false)
      expect(result.message?.rejection.type).toBe("insufficient_gold")
    }
  })

  it("プラン未選択の場合は意味的な拒否理由を返す", () => {
    const state = toInnScene(MOCK_VAULT)
    const action = { type: "CONFIRM_STAY" as const }

    const result = reduce(state, action)

    expect(result.type).toBe("inn")
    if (result.type === "inn") {
      expect(result.message).toEqual({
        type: "stay_rejected",
        rejection: { type: "no_plan_selected" },
      })
    }
  })

  it("inn以外のフェーズでは状態を変更しない", () => {
    const villageState = toVillageScene(MOCK_VAULT)
    const action = { type: "CONFIRM_STAY" as const }

    const result = reduce(villageState as never, action)

    expect(result as never).toBe(villageState as never)
  })
})

describe("CANCEL_STAY", () => {
  it("プラン選択をキャンセルできる", () => {
    const state = toInnScene(MOCK_VAULT)
      .withSelectedPlan("deluxe")
      .withConfirmingStay(true)
    const action = { type: "CANCEL_STAY" as const }

    const result = reduce(state, action)

    expect(result.type).toBe("inn")
    if (result.type === "inn") {
      expect(result.selectedPlan).toBe(null)
      expect(result.confirmingStay).toBe(false)
    }
  })

  it("inn以外のフェーズでは状態を変更しない", () => {
    const villageState = toVillageScene(MOCK_VAULT)
    const action = { type: "CANCEL_STAY" as const }

    const result = reduce(villageState as never, action)

    expect(result as never).toBe(villageState as never)
  })
})

describe("LEAVE_INN", () => {
  it("宿屋を出て村フェーズに戻る", () => {
    const state = toInnScene(MOCK_VAULT)
    const action = { type: "LEAVE_INN" as const }

    const result = reduce(state, action)

    expect(result.type).toBe("village")
  })

  it("ゲームログにLEFT_INNが記録される", () => {
    const state = toInnScene(MOCK_VAULT)
    const action = { type: "LEAVE_INN" as const }

    const result = reduce(state, action)

    const hasLeftInnLog = result.vault.log.some((log) => log.key === "LEFT_INN")
    expect(hasLeftInnLog).toBe(true)
  })

  it("inn以外のフェーズでは状態を変更しない", () => {
    const villageState = toVillageScene(MOCK_VAULT)
    const action = { type: "LEAVE_INN" as const }

    const result = reduce(villageState as never, action)

    expect(result as never).toBe(villageState as never)
  })
})

describe("不明なアクション", () => {
  it("innフェーズで不明なアクションの場合は状態が変わらない", () => {
    const state = toInnScene(MOCK_VAULT)

    const result = reduce(state, { type: "UNKNOWN_ACTION" } as never)

    expect(result).toBe(state)
  })
})

describe("WizStateInn message ownership", () => {
  it("semantic rejection inputを所有する", () => {
    const message: {
      type: "stay_rejected"
      rejection: {
        type: "insufficient_gold"
        planId: string
        required: number
        available: number
        shortfall: number
      }
    } = {
      type: "stay_rejected",
      rejection: {
        type: "insufficient_gold",
        planId: "deluxe",
        required: 100,
        available: 20,
        shortfall: 80,
      },
    }
    const state = toInnScene(MOCK_VAULT).withMessage(message)

    message.rejection.shortfall = 0

    expect(state.message?.rejection).toMatchObject({ shortfall: 80 })
    expect(Object.isFrozen(state.message)).toBe(true)
    expect(Object.isFrozen(state.message?.rejection)).toBe(true)
  })
})
