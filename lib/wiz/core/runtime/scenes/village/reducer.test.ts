import { describe, expect, it } from "vite-plus/test"
import {
  MOCK_CONTENT,
  MOCK_INITIAL_STATE,
  MOCK_SHOP_DIALOGUE_SERVICE,
} from "@/lib/wiz/core/mocks/mock-vault"
import { WizEngineShopDialogueService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-dialogue-service"
import { WizSceneTransitionService } from "@/lib/wiz/core/runtime/scene-transition-service"
import { MOCK_BATTLE_AUTHORITIES } from "@/lib/wiz/core/mocks/mock-battle-authorities"
import type { WizSceneVillageAction } from "@/lib/wiz/core/runtime/scenes/village/action"
import { WizSceneVillageReducer } from "@/lib/wiz/core/runtime/scenes/village/reducer"

const reducer = new WizSceneVillageReducer()
const customShopDialogueService = new WizEngineShopDialogueService([
  {
    shopId: "moonlit_apothecary",
    shopkeeperName: "Luna",
    greeting: "Welcome",
    products: {
      itemIds: [],
      weaponIds: [],
      armorIds: [],
    },
    topics: [],
  },
])
const contentBoundReducer = new WizSceneVillageReducer({
  shopDialogueService: customShopDialogueService,
})
const transitionService = new WizSceneTransitionService({
  ...MOCK_BATTLE_AUTHORITIES,
  content: MOCK_CONTENT,
  shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
})
const customShopTransitionService = new WizSceneTransitionService({
  ...MOCK_BATTLE_AUTHORITIES,
  content: MOCK_CONTENT,
  shopDialogueService: customShopDialogueService,
})
const reduce = (...args: Parameters<WizSceneVillageReducer["reduce"]>) =>
  transitionService.applyResult(reducer.reduce(...args)).state

describe("SELECT_VILLAGE_ACTION", () => {
  it("選択したアクションが設定される", () => {
    const action: WizSceneVillageAction = {
      type: "SELECT_VILLAGE_ACTION",
      action: "explore",
    }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    if (newState.type === "village") {
      expect(newState.selectedAction).toBe("explore")
    }
  })

  it("別のアクションに切り替えられる", () => {
    const firstAction: WizSceneVillageAction = {
      type: "SELECT_VILLAGE_ACTION",
      action: "explore",
    }
    const secondAction: WizSceneVillageAction = {
      type: "SELECT_VILLAGE_ACTION",
      action: "shop",
    }

    let state = reduce(MOCK_INITIAL_STATE, firstAction)
    state = reduce(state, secondAction)

    if (state.type === "village") {
      expect(state.selectedAction).toBe("shop")
    }
  })

  it("villageフェーズ以外では状態を変更しない", () => {
    const action: WizSceneVillageAction = {
      type: "SELECT_VILLAGE_ACTION",
      action: "explore",
    }
    const shopAction: WizSceneVillageAction = {
      type: "GO_TO_SHOP",
      shopId: "moonlit_apothecary",
    }
    const shopState = customShopTransitionService.applyResult(
      contentBoundReducer.reduce(MOCK_INITIAL_STATE, shopAction),
    ).state

    const newState = reduce(shopState, action)

    expect(newState.type).toBe("shop")
  })
})

describe("GO_TO_SHOP", () => {
  it("contentの任意shopIdをcanonical IDのまま遷移へ渡す", () => {
    const result = contentBoundReducer.reduce(MOCK_INITIAL_STATE, {
      type: "GO_TO_SHOP",
      shopId: "moonlit_apothecary",
    })
    const newState = customShopTransitionService.applyResult(result).state

    expect(result).toMatchObject({
      transition: {
        type: "GO_TO_SHOP",
        shopId: "moonlit_apothecary",
      },
    })
    expect(newState.type).toBe("shop")
    if (newState.type === "shop") {
      expect(newState.shopId).toBe("moonlit_apothecary")
    }
    expect(newState.vault.log.at(-1)).toEqual({
      key: "ENTERED_SHOP",
      shopId: "moonlit_apothecary",
    })
  })

  it("存在しないshopIdをsemantic reason付きで拒否する", () => {
    const result = contentBoundReducer.reduce(MOCK_INITIAL_STATE, {
      type: "GO_TO_SHOP",
      shopId: "missing_shop",
    })

    expect(result).toMatchObject({
      accepted: false,
      reason: "SHOP_NOT_FOUND",
    })
    expect(result.state).toBe(MOCK_INITIAL_STATE)
  })
})

describe("GO_TO_INN", () => {
  it("宿屋に移動できる", () => {
    const action: WizSceneVillageAction = { type: "GO_TO_INN" }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    expect(newState.type).toBe("inn")
  })

  it("宿屋入店ログが記録される", () => {
    const action: WizSceneVillageAction = { type: "GO_TO_INN" }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    const enteredInnLog = newState.vault.log.find((log) => log.key === "ENTERED_INN")
    expect(enteredInnLog).toBeDefined()
  })

  it("宿屋フェーズの初期状態が正しい", () => {
    const action: WizSceneVillageAction = { type: "GO_TO_INN" }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    if (newState.type === "inn") {
      expect(newState.selectedPlan).toBeNull()
      expect(newState.confirmingStay).toBe(false)
      expect(newState.message).toBeNull()
    }
  })
})

describe("GO_TO_EXPLORATION", () => {
  it("APが十分でアンロック済みのエリアに移動できる", () => {
    const forestArea = MOCK_INITIAL_STATE.vault.areas.find((a) => a.id === "forest")
    expect(forestArea).toBeDefined()
    expect(forestArea?.unlocked).toBe(true)

    const action: WizSceneVillageAction = {
      type: "GO_TO_EXPLORATION",
      areaId: "forest",
    }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    expect(newState.type).toBe("exploration")
    if (newState.type === "exploration") {
      expect(newState.areaId).toBe("forest")
    }
  })

  it("探索時にAPが消費される", () => {
    const initialAp = MOCK_INITIAL_STATE.vault.player.ap
    const forestArea = MOCK_INITIAL_STATE.vault.areas.find((a) => a.id === "forest")
    const apCost = forestArea?.apCost ?? 0

    const action: WizSceneVillageAction = {
      type: "GO_TO_EXPLORATION",
      areaId: "forest",
    }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    expect(newState.vault.player.ap).toBe(initialAp - apCost)
  })

  it("APが不足している場合は移動できない", () => {
    const stateWithLowAp = MOCK_INITIAL_STATE.updateVault((v) => v.updatePlayer((p) => p.withAp(0)))

    const action: WizSceneVillageAction = {
      type: "GO_TO_EXPLORATION",
      areaId: "forest",
    }

    const newState = reduce(stateWithLowAp, action)

    expect(newState.type).toBe("village")
    const notEnoughApLog = newState.vault.log.find((log) => log.key === "NOT_ENOUGH_AP")
    expect(notEnoughApLog).toBeDefined()
  })

  it("ロックされたエリアには移動できない", () => {
    const stateWithLockedArea = MOCK_INITIAL_STATE.updateVault((v) =>
      v.withAreas(v.areas.map((a) => (a.id === "forest" ? { ...a, unlocked: false } : a))),
    )

    const action: WizSceneVillageAction = {
      type: "GO_TO_EXPLORATION",
      areaId: "forest",
    }

    const newState = reduce(stateWithLockedArea, action)

    expect(newState.type).toBe("village")
  })

  it("存在しないエリアには移動できない", () => {
    const action: WizSceneVillageAction = {
      type: "GO_TO_EXPLORATION",
      areaId: "non-existent-area",
    }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    expect(newState.type).toBe("village")
  })

  it("エリア入場ログが記録される", () => {
    const action: WizSceneVillageAction = {
      type: "GO_TO_EXPLORATION",
      areaId: "forest",
    }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    const enteredAreaLog = newState.vault.log.find((log) => log.key === "ENTERED_AREA")
    expect(enteredAreaLog).toBeDefined()
    if (enteredAreaLog && "areaId" in enteredAreaLog) {
      expect(enteredAreaLog.areaId).toBe("forest")
    }
  })
})

describe("TALK_TO_NPC", () => {
  it("存在するNPCと会話できる", () => {
    const npc = MOCK_INITIAL_STATE.vault.npcs[0]
    expect(npc).toBeDefined()

    const action: WizSceneVillageAction = { type: "TALK_TO_NPC", npcId: npc.id }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    expect(newState.type).toBe("conversation")
    if (newState.type === "conversation") {
      expect(newState.npcId).toBe(npc.id)
    }
  })

  it("存在しないNPCには会話できない", () => {
    const action: WizSceneVillageAction = {
      type: "TALK_TO_NPC",
      npcId: "non-existent-npc",
    }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    expect(newState.type).toBe("village")
  })

  it("NPC会話ログが記録される", () => {
    const npc = MOCK_INITIAL_STATE.vault.npcs[0]
    const action: WizSceneVillageAction = { type: "TALK_TO_NPC", npcId: npc.id }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    const talkLog = newState.vault.log.find((log) => log.key === "TALKED_TO_NPC")
    expect(talkLog).toBeDefined()
    if (talkLog && "npcId" in talkLog) {
      expect(talkLog.npcId).toBe(npc.id)
    }
  })

  it("会話フェーズの初期状態が正しい", () => {
    const npc = MOCK_INITIAL_STATE.vault.npcs[0]
    const action: WizSceneVillageAction = { type: "TALK_TO_NPC", npcId: npc.id }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    if (newState.type === "conversation") {
      expect(newState.dialogueIndex).toBe(1)
      expect(newState.transcript).toHaveLength(2)
      expect(newState.pendingGiftItemId).toBeNull()
      expect(newState.affinityGained).toBe(0)
    }
  })
})

describe("GO_TO_QUEST", () => {
  it("クエストフェーズに移動できる", () => {
    const action: WizSceneVillageAction = { type: "GO_TO_QUEST" }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    expect(newState.type).toBe("quest")
  })

  it("クエストフェーズの初期状態が正しい", () => {
    const action: WizSceneVillageAction = { type: "GO_TO_QUEST" }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    if (newState.type === "quest") {
      expect(newState.selectedQuest).toBeNull()
      expect(newState.message).toBeNull()
    }
  })
})

describe("GO_TO_CRAFTING", () => {
  it("製作フェーズに移動できる", () => {
    const action: WizSceneVillageAction = { type: "GO_TO_CRAFTING" }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    expect(newState.type).toBe("crafting")
  })

  it("製作フェーズの初期状態が正しい", () => {
    const action: WizSceneVillageAction = { type: "GO_TO_CRAFTING" }

    const newState = reduce(MOCK_INITIAL_STATE, action)

    if (newState.type === "crafting") {
      expect(newState.selectedRecipe).toBeNull()
      expect(newState.confirmingCraft).toBe(false)
      expect(newState.result).toEqual({ status: "pending" })
      expect(newState.message).toBeNull()
    }
  })
})

describe("未知のアクション", () => {
  it("未知のアクションでは状態を変更しない", () => {
    const unknownAction = { type: "UNKNOWN_ACTION" } as never

    const newState = reduce(MOCK_INITIAL_STATE, unknownAction)

    expect(newState).toBe(MOCK_INITIAL_STATE)
  })
})

describe("semantic rejection", () => {
  it("存在しないエリアへの移動を理由付きで拒否する", () => {
    const result = reducer.reduce(MOCK_INITIAL_STATE, {
      type: "GO_TO_EXPLORATION",
      areaId: "missing",
    })

    expect(result).toMatchObject({
      accepted: false,
      reason: "VILLAGE_ACTION_REJECTED",
    })
    expect(result.state).toBe(MOCK_INITIAL_STATE)
  })

  it("AP不足の表示用stateを保持しつつ操作自体は拒否する", () => {
    const state = MOCK_INITIAL_STATE.updateVault((vault) =>
      vault.updatePlayer((player) => player.withAp(0)),
    )

    const result = reducer.reduce(state, {
      type: "GO_TO_EXPLORATION",
      areaId: "forest",
    })

    expect(result).toMatchObject({
      accepted: false,
      reason: "VILLAGE_ACTION_REJECTED",
    })
    expect(result.state.vault.log.at(-1)).toEqual({ key: "NOT_ENOUGH_AP" })
  })

  it("存在しないNPCとの会話を理由付きで拒否する", () => {
    const result = reducer.reduce(MOCK_INITIAL_STATE, {
      type: "TALK_TO_NPC",
      npcId: "missing",
    })

    expect(result).toMatchObject({
      accepted: false,
      reason: "VILLAGE_ACTION_REJECTED",
    })
    expect(result.state).toBe(MOCK_INITIAL_STATE)
  })
})
