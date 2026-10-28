import { describe, expect, it } from "vite-plus/test"
import {
  MOCK_CONTENT,
  MOCK_INITIAL_STATE,
  MOCK_SHOP_DIALOGUE_SERVICE,
} from "@/lib/wiz/core/mocks/mock-vault"
import { WizSceneResultFactory } from "@/lib/wiz/core/runtime/scene-result"
import { WizSceneTransitionService } from "@/lib/wiz/core/runtime/scene-transition-service"
import { MOCK_BATTLE_AUTHORITIES } from "@/lib/wiz/core/mocks/mock-battle-authorities"

const service = new WizSceneTransitionService({
  ...MOCK_BATTLE_AUTHORITIES,
  content: MOCK_CONTENT,
  shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
})

describe("WizSceneTransitionService", () => {
  it("構築できる", () => {
    const instance = new WizSceneTransitionService({
      ...MOCK_BATTLE_AUTHORITIES,
      content: MOCK_CONTENT,
      shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
    })

    expect(instance).toBeDefined()
  })
})

describe("applyResult", () => {
  it("transition がない場合は state がそのまま返る", () => {
    const result = WizSceneResultFactory.accept(MOCK_INITIAL_STATE)

    const appliedResult = service.applyResult(result)

    expect(appliedResult).toBe(result)
    expect(appliedResult.state).toBe(MOCK_INITIAL_STATE)
  })
})

describe("GO_TO_VILLAGE", () => {
  it("village state が作られる", () => {
    const result = WizSceneResultFactory.accept(MOCK_INITIAL_STATE, {
      type: "GO_TO_VILLAGE",
    })

    const newState = service.applyResult(result).state

    expect(newState.type).toBe("village")
    if (newState.type === "village") {
      expect(newState.selectedAction).toBeNull()
    }
  })
})

describe("GO_TO_EXPLORATION", () => {
  it("exploration state が作られる", () => {
    const result = WizSceneResultFactory.accept(MOCK_INITIAL_STATE, {
      type: "GO_TO_EXPLORATION",
      areaId: "forest",
    })

    const newState = service.applyResult(result).state

    expect(newState.type).toBe("exploration")
    if (newState.type === "exploration") {
      expect(newState.areaId).toBe("forest")
      expect(newState.eventProgress).toEqual({ status: "none" })
      expect(newState.message).toBeNull()
    }
  })
})

describe("GO_TO_SHOP", () => {
  it("shop state が作られる", () => {
    const result = WizSceneResultFactory.accept(MOCK_INITIAL_STATE, {
      type: "GO_TO_SHOP",
      shopId: "item_shop",
    })

    const newState = service.applyResult(result).state

    expect(newState.type).toBe("shop")
    if (newState.type === "shop") {
      expect(newState.shopId).toBe("item_shop")
      expect(newState.pendingPurchase).toBeNull()
      expect(newState.message).toBeNull()
      expect(newState.conversation).toBeNull()
      expect(newState.lastConversation).toBeNull()
    }
  })
})
