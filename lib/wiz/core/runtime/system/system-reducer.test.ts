import { describe, expect, it } from "vite-plus/test"
import { MOCK_INITIAL_STATE, MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import type { WizContext } from "@/lib/wiz/core/context"
import type { WizState } from "@/lib/wiz/core/runtime/state"
import type { WizSystemAction } from "@/lib/wiz/core/runtime/system/system-action"
import { WizSystemReducer } from "@/lib/wiz/core/runtime/system/system-reducer"

const context: WizContext = {
  initialVault: MOCK_VAULT,
  initialWorldState: MOCK_INITIAL_STATE,
}

const reducer = new WizSystemReducer({ context })

describe("ADD_LOG", () => {
  it("ログメッセージが vault に追加される", () => {
    const action: WizSystemAction = {
      type: "ADD_LOG",
      message: { key: "SEASON_CHANGED", season: "spring" },
    }

    const newState = reducer.reduce(MOCK_INITIAL_STATE, action)

    const lastLog = newState.vault.log[newState.vault.log.length - 1]
    expect(lastLog).toEqual({ key: "SEASON_CHANGED", season: "spring" })
  })

  it("複数のログを追加できる", () => {
    const action1: WizSystemAction = {
      type: "ADD_LOG",
      message: { key: "SEASON_CHANGED", season: "spring" },
    }
    const action2: WizSystemAction = {
      type: "ADD_LOG",
      message: { key: "SEASON_CHANGED", season: "summer" },
    }

    let state: WizState = reducer.reduce(MOCK_INITIAL_STATE, action1)
    state = reducer.reduce(state, action2)

    const logs = state.vault.log
    expect(logs[logs.length - 2]).toEqual({ key: "SEASON_CHANGED", season: "spring" })
    expect(logs[logs.length - 1]).toEqual({ key: "SEASON_CHANGED", season: "summer" })
  })
})

describe("ADVANCE_TIME", () => {
  it("時間帯が進む", () => {
    const action: WizSystemAction = { type: "ADVANCE_TIME" }

    const newState = reducer.reduce(MOCK_INITIAL_STATE, action)

    expect(newState.vault.time.timeOfDay).not.toBe(MOCK_INITIAL_STATE.vault.time.timeOfDay)
  })

  it("morning から noon に進む", () => {
    const morningState = MOCK_INITIAL_STATE.updateVault((v) =>
      v.withTime({ ...v.time, timeOfDay: "morning" }),
    )
    const action: WizSystemAction = { type: "ADVANCE_TIME" }

    const newState = reducer.reduce(morningState, action)

    expect(newState.vault.time.timeOfDay).toBe("noon")
  })
})

describe("WORLD_ENDED", () => {
  it("world終了状態になる", () => {
    const action: WizSystemAction = { type: "WORLD_ENDED" }

    const newState = reducer.reduce(MOCK_INITIAL_STATE, action)

    expect(newState.vault.isEnded).toBe(true)
  })

  it("元の状態がゲームオーバーでない場合に変化する", () => {
    expect(MOCK_INITIAL_STATE.vault.isEnded).toBe(false)

    const action: WizSystemAction = { type: "WORLD_ENDED" }
    const newState = reducer.reduce(MOCK_INITIAL_STATE, action)

    expect(newState.vault.isEnded).toBe(true)
  })
})

describe("WORLD_RESET", () => {
  it("初期状態にリセットされる", () => {
    const modifiedState = MOCK_INITIAL_STATE.updateVault((v) =>
      v.updatePlayer((p) => p.addGold(999)).withEnded(true),
    )
    const action: WizSystemAction = { type: "WORLD_RESET" }

    const newState = reducer.reduce(modifiedState, action)

    expect(newState.vault.isEnded).toBe(false)
    expect(newState.vault.player.gold).toBe(MOCK_VAULT.player.gold)
  })

  it("リセット後のログに WORLD_STARTED が含まれる", () => {
    const action: WizSystemAction = { type: "WORLD_RESET" }

    const newState = reducer.reduce(MOCK_INITIAL_STATE, action)

    expect(newState.vault.log).toEqual([{ key: "WORLD_STARTED" }])
  })

  it("リセット後の vault が初期値と一致する", () => {
    const modifiedState = MOCK_INITIAL_STATE.updateVault((v) =>
      v
        .updatePlayer((p) => p.damage(30))
        .addFlag("test-flag")
        .addLog({ key: "WORLD_STARTED" }),
    )
    const action: WizSystemAction = { type: "WORLD_RESET" }

    const newState = reducer.reduce(modifiedState, action)

    expect(newState.vault.player.hp).toBe(MOCK_VAULT.player.hp)
    expect(newState.vault.flags).toEqual(MOCK_VAULT.flags)
  })
})

describe("NEW_DAY", () => {
  it("日数が1日進む", () => {
    const action: WizSystemAction = { type: "NEW_DAY" }

    const newState = reducer.reduce(MOCK_INITIAL_STATE, action)

    expect(newState.vault.time.day).toBe(MOCK_INITIAL_STATE.vault.time.day + 1)
  })

  it("時間帯が朝にリセットされる", () => {
    const eveningState = MOCK_INITIAL_STATE.updateVault((v) =>
      v.withTime({ ...v.time, timeOfDay: "evening" }),
    )
    const action: WizSystemAction = { type: "NEW_DAY" }

    const newState = reducer.reduce(eveningState, action)

    expect(newState.vault.time.timeOfDay).toBe("morning")
  })

  it("AP が最大値にリセットされる", () => {
    const lowApState = MOCK_INITIAL_STATE.updateVault((v) => v.updatePlayer((p) => p.useAp(3)))
    expect(lowApState.vault.player.ap).toBeLessThan(lowApState.vault.player.maxAp)

    const action: WizSystemAction = { type: "NEW_DAY" }
    const newState = reducer.reduce(lowApState, action)

    expect(newState.vault.player.ap).toBe(newState.vault.player.maxAp)
  })
})

describe("未知のアクション", () => {
  it("未知のアクションでは状態を変更しない", () => {
    const unknownAction = { type: "UNKNOWN_ACTION" } as never

    const newState = reducer.reduce(MOCK_INITIAL_STATE, unknownAction)

    expect(newState).toBe(MOCK_INITIAL_STATE)
  })
})
