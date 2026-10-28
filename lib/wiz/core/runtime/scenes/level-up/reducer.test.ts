import { describe, expect, it } from "vite-plus/test"
import {
  MOCK_CONTENT,
  MOCK_SHOP_DIALOGUE_SERVICE,
  MOCK_VAULT,
} from "@/lib/wiz/core/mocks/mock-vault"
import { WizSceneTransitionService } from "@/lib/wiz/core/runtime/scene-transition-service"
import { MOCK_BATTLE_AUTHORITIES } from "@/lib/wiz/core/mocks/mock-battle-authorities"
import { toLevelUpScene } from "@/lib/wiz/core/runtime/to-level-up-scene"
import { WizSceneLevelUpReducer } from "@/lib/wiz/core/runtime/scenes/level-up/reducer"
import type { WizState } from "@/lib/wiz/core/runtime/state"

const reducer = new WizSceneLevelUpReducer()
const readyVault = MOCK_VAULT.updatePlayer((player) =>
  player.addExp(player.expToNextLevel)
)
const transitionService = new WizSceneTransitionService({
  ...MOCK_BATTLE_AUTHORITIES,
  content: MOCK_CONTENT,
  shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
})
const reduce = (...args: Parameters<WizSceneLevelUpReducer["reduce"]>) =>
  transitionService.applyResult(reducer.reduce(...args)).state

function createConfirmableState(): WizState {
  let state: WizState = toLevelUpScene(readyVault, 3)
  for (const attribute of ["strength", "dexterity", "vitality"] as const) {
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute,
    })
  }
  return state
}

describe("ALLOCATE_ATTRIBUTE", () => {
  it("ポイントを strength に割り振れる", () => {
    const state = toLevelUpScene(MOCK_VAULT, 5)

    const result = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })

    expect(result.type).toBe("level_up")
    if (result.type === "level_up") {
      expect(result.availablePoints).toBe(4)
      expect(result.pendingAttributes.strength).toBe(1)
    }
  })

  it("ポイントを dexterity に割り振れる", () => {
    const state = toLevelUpScene(MOCK_VAULT, 5)

    const result = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "dexterity",
    })

    expect(result.type).toBe("level_up")
    if (result.type === "level_up") {
      expect(result.availablePoints).toBe(4)
      expect(result.pendingAttributes.dexterity).toBe(1)
    }
  })

  it("ポイントを agility に割り振れる", () => {
    const state = toLevelUpScene(MOCK_VAULT, 5)

    const result = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "agility",
    })

    expect(result.type).toBe("level_up")
    if (result.type === "level_up") {
      expect(result.availablePoints).toBe(4)
      expect(result.pendingAttributes.agility).toBe(1)
    }
  })

  it("ポイントを vitality に割り振れる", () => {
    const state = toLevelUpScene(MOCK_VAULT, 5)

    const result = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "vitality",
    })

    expect(result.type).toBe("level_up")
    if (result.type === "level_up") {
      expect(result.availablePoints).toBe(4)
      expect(result.pendingAttributes.vitality).toBe(1)
    }
  })

  it("ポイントを wisdom に割り振れる", () => {
    const state = toLevelUpScene(MOCK_VAULT, 5)

    const result = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "wisdom",
    })

    expect(result.type).toBe("level_up")
    if (result.type === "level_up") {
      expect(result.availablePoints).toBe(4)
      expect(result.pendingAttributes.wisdom).toBe(1)
    }
  })

  it("ポイントを charisma に割り振れる", () => {
    const state = toLevelUpScene(MOCK_VAULT, 5)

    const result = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "charisma",
    })

    expect(result.type).toBe("level_up")
    if (result.type === "level_up") {
      expect(result.availablePoints).toBe(4)
      expect(result.pendingAttributes.charisma).toBe(1)
    }
  })

  it("同じステータスに複数回割り振れる", () => {
    let state: WizState = toLevelUpScene(MOCK_VAULT, 5)

    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })

    expect(state.type).toBe("level_up")
    if (state.type === "level_up") {
      expect(state.availablePoints).toBe(2)
      expect(state.pendingAttributes.strength).toBe(3)
    }
  })

  it("複数のステータスに割り振れる", () => {
    let state: WizState = toLevelUpScene(MOCK_VAULT, 5)

    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "dexterity",
    })
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "vitality",
    })

    expect(state.type).toBe("level_up")
    if (state.type === "level_up") {
      expect(state.availablePoints).toBe(2)
      expect(state.pendingAttributes.strength).toBe(1)
      expect(state.pendingAttributes.dexterity).toBe(1)
      expect(state.pendingAttributes.vitality).toBe(1)
    }
  })

  it("ポイントが0の場合は割り振れない", () => {
    const state = toLevelUpScene(MOCK_VAULT, 0)

    const result = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })

    expect(result).toBe(state)
  })

  it("ポイントを使い切った後は割り振れない", () => {
    let state: WizState = toLevelUpScene(MOCK_VAULT, 2)

    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })
    const lastState = state
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })

    expect(state).toBe(lastState)
    if (state.type === "level_up") {
      expect(state.availablePoints).toBe(0)
      expect(state.pendingAttributes.strength).toBe(2)
    }
  })
})

describe("RESET_PENDING_ATTRIBUTES", () => {
  it("割り振ったポイントをリセットできる", () => {
    let state: WizState = toLevelUpScene(MOCK_VAULT, 5)
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "dexterity",
    })
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "vitality",
    })

    const result = reduce(state, { type: "RESET_PENDING_ATTRIBUTES" })

    expect(result.type).toBe("level_up")
    if (result.type === "level_up") {
      expect(result.availablePoints).toBe(5)
      expect(result.pendingAttributes).toEqual({})
    }
  })

  it("全ポイントを使い切った後でもリセットできる", () => {
    let state: WizState = toLevelUpScene(MOCK_VAULT, 3)
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })

    const result = reduce(state, { type: "RESET_PENDING_ATTRIBUTES" })

    expect(result.type).toBe("level_up")
    if (result.type === "level_up") {
      expect(result.availablePoints).toBe(3)
      expect(result.pendingAttributes).toEqual({})
    }
  })

  it("ポイントを割り振っていない場合も正常に動作する", () => {
    const state = toLevelUpScene(MOCK_VAULT, 5)

    const result = reduce(state, { type: "RESET_PENDING_ATTRIBUTES" })

    expect(result.type).toBe("level_up")
    if (result.type === "level_up") {
      expect(result.availablePoints).toBe(5)
      expect(result.pendingAttributes).toEqual({})
    }
  })
})

describe("CONFIRM_LEVEL_UP", () => {
  it("ポイントを使い切った場合にレベルアップを確定できる", () => {
    let state: WizState = toLevelUpScene(readyVault, 3)
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "dexterity",
    })
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "vitality",
    })

    const result = reduce(state, { type: "CONFIRM_LEVEL_UP" })

    expect(result.type).toBe("village")
  })

  it("レベルアップ確定後にステータスが反映される", () => {
    const initialStrength = MOCK_VAULT.player.attributes.strength
    const initialDexterity = MOCK_VAULT.player.attributes.dexterity
    let state: WizState = toLevelUpScene(readyVault, 3)
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "dexterity",
    })
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "charisma",
    })

    const result = reduce(state, { type: "CONFIRM_LEVEL_UP" })

    expect(result.vault.player.attributes.strength).toBe(initialStrength + 1)
    expect(result.vault.player.attributes.dexterity).toBe(initialDexterity + 1)
  })

  it("レベルアップ確定後にプレイヤーレベルが上がる", () => {
    const initialLevel = MOCK_VAULT.player.level
    const state = createConfirmableState()

    const result = reduce(state, { type: "CONFIRM_LEVEL_UP" })

    expect(result.vault.player.level).toBe(initialLevel + 1)
  })

  it("レベルアップ確定後にログが記録される", () => {
    const state = createConfirmableState()

    const result = reduce(state, { type: "CONFIRM_LEVEL_UP" })

    const log = result.vault.log
    const levelUpLog = log.find((l) => l.key === "LEVEL_UP")
    expect(levelUpLog).toBeDefined()
  })

  it("vitality を上げると HP 最大値が増加する", () => {
    const initialMaxHp = MOCK_VAULT.player.maxHp
    let state: WizState = toLevelUpScene(readyVault, 3)
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "vitality",
    })
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "vitality",
    })
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "vitality",
    })

    const result = reduce(state, { type: "CONFIRM_LEVEL_UP" })

    // vitality を3上げたので、HP最大値は基本上昇 + ボーナスで増加
    expect(result.vault.player.maxHp).toBeGreaterThan(initialMaxHp)
  })

  it("ポイントが残っている場合は確定できない", () => {
    let state: WizState = toLevelUpScene(readyVault, 3)
    state = reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })
    // 2ポイント残っている

    const result = reduce(state, { type: "CONFIRM_LEVEL_UP" })

    expect(result).toBe(state)
    expect(result.type).toBe("level_up")
  })

  it("ポイントを一切使っていない場合は確定できない", () => {
    const state = toLevelUpScene(readyVault, 3)

    const result = reduce(state, { type: "CONFIRM_LEVEL_UP" })

    expect(result).toBe(state)
    expect(result.type).toBe("level_up")
  })

  it("設定値と一致しない0ポイント状態は確定できない", () => {
    const state = toLevelUpScene(readyVault, 0)

    const result = reduce(state, { type: "CONFIRM_LEVEL_UP" })

    expect(result).toBe(state)
    expect(result.type).toBe("level_up")
  })
})

describe("フェーズガード", () => {
  it("level_up 以外のフェーズでは ALLOCATE_ATTRIBUTE が無視される", () => {
    const result = reduce(createConfirmableState(), {
      type: "CONFIRM_LEVEL_UP",
    })

    const allocateResult = reduce(result, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })

    expect(allocateResult).toBe(result)
  })

  it("level_up 以外のフェーズでは RESET_PENDING_ATTRIBUTES が無視される", () => {
    const result = reduce(createConfirmableState(), {
      type: "CONFIRM_LEVEL_UP",
    })

    const resetResult = reduce(result, {
      type: "RESET_PENDING_ATTRIBUTES",
    })

    expect(resetResult).toBe(result)
  })

  it("level_up 以外のフェーズでは CONFIRM_LEVEL_UP が無視される", () => {
    const result = reduce(createConfirmableState(), {
      type: "CONFIRM_LEVEL_UP",
    })

    // 既に village になっているので再度 CONFIRM_LEVEL_UP しても変わらない
    const confirmResult = reduce(result, { type: "CONFIRM_LEVEL_UP" })

    expect(confirmResult).toBe(result)
  })
})

describe("semantic rejection", () => {
  it("残りポイントがない属性割り振りを理由付きで拒否する", () => {
    const state = toLevelUpScene(MOCK_VAULT, 0)

    const result = reducer.reduce(state, {
      type: "ALLOCATE_ATTRIBUTE",
      attribute: "strength",
    })

    expect(result).toMatchObject({
      accepted: false,
      reason: "LEVEL_UP_REJECTED",
    })
    expect(result.state).toBe(state)
  })

  it("未割り振り状態のリセットを理由付きで拒否する", () => {
    const state = toLevelUpScene(MOCK_VAULT, 1)

    const result = reducer.reduce(state, { type: "RESET_PENDING_ATTRIBUTES" })

    expect(result).toMatchObject({
      accepted: false,
      reason: "LEVEL_UP_REJECTED",
    })
    expect(result.state).toBe(state)
  })

  it("ポイントが残る確定を理由付きで拒否する", () => {
    const state = toLevelUpScene(readyVault, 1)

    const result = reducer.reduce(state, { type: "CONFIRM_LEVEL_UP" })

    expect(result).toMatchObject({
      accepted: false,
      reason: "LEVEL_UP_REJECTED",
    })
    expect(result.state).toBe(state)
  })

  it("負の残りポイントを持つ偽造状態を拒否する", () => {
    const state = toLevelUpScene(readyVault, -1).withPendingAttributes({
      strength: 3,
    })

    const result = reducer.reduce(state, { type: "CONFIRM_LEVEL_UP" })

    expect(result).toMatchObject({
      accepted: false,
      reason: "LEVEL_UP_REJECTED",
    })
    expect(result.state).toBe(state)
  })

  it("設定値と一致しない振り分け合計を拒否する", () => {
    const state = toLevelUpScene(readyVault, 0).withPendingAttributes({
      strength: 2,
    })

    const result = reducer.reduce(state, { type: "CONFIRM_LEVEL_UP" })

    expect(result).toMatchObject({
      accepted: false,
      reason: "LEVEL_UP_REJECTED",
    })
    expect(result.state).toBe(state)
  })

  it("必要経験値に達していない偽造状態を拒否する", () => {
    const state = toLevelUpScene(MOCK_VAULT, 0).withPendingAttributes({
      strength: 3,
    })

    const result = reducer.reduce(state, { type: "CONFIRM_LEVEL_UP" })

    expect(result).toMatchObject({
      accepted: false,
      reason: "LEVEL_UP_REJECTED",
    })
    expect(result.state).toBe(state)
  })
})
