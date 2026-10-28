import { describe, expect, it } from "vite-plus/test"
import { WizEngineBattleExecutionResult } from "@/lib/wiz/core/engine/battle/execution/execution-result"
import { wizMockWeakEnemyParty } from "@/lib/wiz/core/mocks/wiz-mock-weak-enemy-party"
import { wizMockSoloParty } from "@/lib/wiz/core/mocks/wiz-mock-solo-party"
import type { WizLogMessage } from "@/lib/wiz/core/types/wiz-log-message"

const createResult = () => {
  const party = wizMockSoloParty()
  const enemies = wizMockWeakEnemyParty()
  const logs: WizLogMessage[] = [
    { key: "BATTLE_ATTACK", actorId: "hero-1", targetId: "goblin-1" },
  ]
  return WizEngineBattleExecutionResult.accept({
    party,
    enemies,
    logs,
    success: true,
  })
}

describe("factory", () => {
  it("実行結果を作成できる", () => {
    const result = createResult()

    expect(result.party).toBeDefined()
    expect(result.enemies).toBeDefined()
    expect(result.logs.length).toBe(1)
    expect(result.success).toBe(true)
  })

  it("失敗の実行結果も作成できる", () => {
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()

    const result = WizEngineBattleExecutionResult.reject({
      party,
      enemies,
      reason: "CUSTOM_REJECTION",
    })

    expect(result.success).toBe(false)
    expect(result.logs.length).toBe(0)
    expect(result.isRejected()).toBe(true)
    if (result.isRejected()) {
      const reason: "CUSTOM_REJECTION" = result.reason
      expect(reason).toBe("CUSTOM_REJECTION")
    }
  })

  it("構築後の入力変更からログを所有分離する", () => {
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const event = { type: "hp_restored" as const, amount: 10 }
    const logs: WizLogMessage[] = [
      {
        key: "ITEM_EFFECT_APPLIED",
        itemId: "potion",
        events: [event],
      },
    ]

    const result = WizEngineBattleExecutionResult.accept({
      party,
      enemies,
      logs,
      success: true,
    })
    logs.push({ key: "BATTLE_START" })
    event.amount = 99

    expect(result.logs).toEqual([
      {
        key: "ITEM_EFFECT_APPLIED",
        itemId: "potion",
        events: [{ type: "hp_restored", amount: 10 }],
      },
    ])
    expect(Object.isFrozen(result.logs)).toBe(true)
    expect(Object.isFrozen(result.logs[0])).toBe(true)
  })

  it("prototypeだけを偽装したresultをauthorityとして認証しない", () => {
    const forged = Object.create(
      WizEngineBattleExecutionResult.prototype
    ) as WizEngineBattleExecutionResult

    expect(() =>
      WizEngineBattleExecutionResult.assertAuthentic(forged)
    ).toThrow(
      "Battle executor must return an authentic WizEngineBattleExecutionResult"
    )
    expect(() => forged.withParty(wizMockSoloParty())).toThrow(
      "Battle executor must return an authentic WizEngineBattleExecutionResult"
    )
    expect(() => forged.isAccepted()).toThrow(
      "Battle executor must return an authentic WizEngineBattleExecutionResult"
    )
    expect(() => forged.isRejected()).toThrow(
      "Battle executor must return an authentic WizEngineBattleExecutionResult"
    )
  })

  it("classとprototypeを固定し、既存instanceの契約を書き換えられない", () => {
    const result = createResult()

    expect(Object.isFrozen(WizEngineBattleExecutionResult)).toBe(true)
    expect(Object.isFrozen(WizEngineBattleExecutionResult.prototype)).toBe(true)
    expect(
      Reflect.set(
        WizEngineBattleExecutionResult.prototype,
        "isAccepted",
        () => false
      )
    ).toBe(false)
    expect(result.isAccepted()).toBe(true)
  })
})

describe("withParty", () => {
  it("パーティを更新した新しい結果を返す", () => {
    const result = createResult()
    const newParty = wizMockSoloParty()

    const newResult = result.withParty(newParty)

    expect(newResult.party).toBe(newParty)
    expect(newResult.enemies).toBe(result.enemies)
    expect(newResult.logs).toBe(result.logs)
  })
})

describe("withEnemies", () => {
  it("敵パーティを更新した新しい結果を返す", () => {
    const result = createResult()
    const newEnemies = wizMockWeakEnemyParty()

    const newResult = result.withEnemies(newEnemies)

    expect(newResult.enemies).toBe(newEnemies)
    expect(newResult.party).toBe(result.party)
  })
})

describe("withLogs", () => {
  it("ログを更新した新しい結果を返す", () => {
    const result = createResult()
    const newLogs: WizLogMessage[] = [
      { key: "BATTLE_DAMAGE", targetId: "goblin-1", damage: 20 },
    ]

    const newResult = result.withLogs(newLogs)

    expect(newResult.logs).not.toBe(newLogs)
    expect(newResult.logs).toEqual(newLogs)
    expect(newResult.logs.length).toBe(1)
  })
})

describe("withAddedLog", () => {
  it("ログを追加した新しい結果を返す", () => {
    const result = createResult()
    const newLog: WizLogMessage = {
      key: "BATTLE_DEATH",
      targetId: "goblin-1",
    }

    const newResult = result.withAddedLog(newLog)

    expect(newResult.logs.length).toBe(2)
    expect(newResult.logs[1]).not.toBe(newLog)
    expect(newResult.logs[1]).toEqual(newLog)
  })
})

describe("toProperties", () => {
  it("プロパティオブジェクトを返す", () => {
    const result = createResult()

    const properties = result.toProperties()

    expect(properties.party).toBe(result.party)
    expect(properties.enemies).toBe(result.enemies)
    expect(properties.logs).toBe(result.logs)
    expect(properties.success).toBe(result.success)
  })
})
