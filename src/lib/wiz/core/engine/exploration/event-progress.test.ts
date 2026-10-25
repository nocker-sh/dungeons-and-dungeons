import { describe, expect, it } from "vite-plus/test"
import { WizEngineExplorationEventProgress } from "@/lib/wiz/core/engine/exploration/event-progress"
import type { WizSkillCheckResult } from "@/lib/wiz/core/types"
import type { WizVaultEventState } from "@/lib/wiz/core/vault/states/event/schema"

const mockEvent: WizVaultEventState = {
  id: "event-001",
  description: "森の中で光る泉を見つけた",
  choices: [
    {
      label: "泉の水を飲む",
      stat: "wisdom",
      difficulty: 8,
      successText: "体力が回復した",
      failText: "お腹を壊した",
    },
    {
      label: "無視して進む",
      successText: "何事もなく通り過ぎた",
      failText: "",
    },
  ],
}

const mockDiceResult: WizSkillCheckResult = {
  dice: [4, 5],
  total: 12,
  modifier: 3,
  targetNumber: 8,
  success: true,
  critical: false,
  fumble: false,
}

const mockFailDiceResult: WizSkillCheckResult = {
  dice: [1, 2],
  total: 6,
  modifier: 3,
  targetNumber: 8,
  success: false,
  critical: false,
  fumble: false,
}

describe("WizEngineExplorationEventProgress", () => {
  describe("イベントの初期状態を生成できる", () => {
    it("none() で status が none になる", () => {
      const progress = WizEngineExplorationEventProgress.none()

      expect(progress.status).toBe("none")
      expect(progress.isNone).toBe(true)
      expect(progress.isEncounter).toBe(false)
      expect(progress.isResult).toBe(false)
    })

    it("none() では event と choiceIndex が null", () => {
      const progress = WizEngineExplorationEventProgress.none()

      expect(progress.event).toBeNull()
      expect(progress.choiceIndex).toBeNull()
    })

    it("encounter() で status が encounter になる", () => {
      const progress = WizEngineExplorationEventProgress.encounter(mockEvent)

      expect(progress.status).toBe("encounter")
      expect(progress.isEncounter).toBe(true)
      expect(progress.isNone).toBe(false)
      expect(progress.event).toEqual(mockEvent)
    })

    it("encounter() の choiceIndex はデフォルトで null", () => {
      const progress = WizEngineExplorationEventProgress.encounter(mockEvent)

      expect(progress.choiceIndex).toBeNull()
    })

    it("encounter() に choiceIndex を指定できる", () => {
      const progress = WizEngineExplorationEventProgress.encounter(mockEvent, 1)

      expect(progress.choiceIndex).toBe(1)
    })
  })

  describe("選択肢を選ぶとステージが進む", () => {
    it("withChoiceIndex で choiceIndex が設定される", () => {
      const progress = WizEngineExplorationEventProgress.encounter(mockEvent)
      const updated = progress.withChoiceIndex(0)

      expect(updated.choiceIndex).toBe(0)
      expect(updated.status).toBe("encounter")
    })

    it("withChoiceIndex は新しいインスタンスを返す", () => {
      const progress = WizEngineExplorationEventProgress.encounter(mockEvent)
      const updated = progress.withChoiceIndex(1)

      expect(updated).not.toBe(progress)
      expect(progress.choiceIndex).toBeNull()
      expect(updated.choiceIndex).toBe(1)
    })

    it("encounter 以外のステータスでは withChoiceIndex が自身を返す", () => {
      const progress = WizEngineExplorationEventProgress.none()
      const updated = progress.withChoiceIndex(0)

      expect(updated).toBe(progress)
    })
  })

  describe("成功/失敗判定が行われる", () => {
    it("toResult で成功結果に遷移する", () => {
      const progress = WizEngineExplorationEventProgress.encounter(mockEvent).withChoiceIndex(0)

      const result = progress.toResult(mockDiceResult, "体力が回復した")

      expect(result.status).toBe("result")
      expect(result.isResult).toBe(true)
      expect(result.diceResult).toEqual(mockDiceResult)
      expect(result.resultText).toBe("体力が回復した")
      expect(result.choiceIndex).toBe(0)
    })

    it("toResult で失敗結果に遷移する", () => {
      const progress = WizEngineExplorationEventProgress.encounter(mockEvent).withChoiceIndex(0)

      const result = progress.toResult(mockFailDiceResult, "お腹を壊した")

      expect(result.status).toBe("result")
      expect(result.diceResult?.success).toBe(false)
      expect(result.resultText).toBe("お腹を壊した")
    })

    it("choiceIndex が null のまま toResult しても遷移しない", () => {
      const progress = WizEngineExplorationEventProgress.encounter(mockEvent)

      const result = progress.toResult(mockDiceResult, "体力が回復した")

      expect(result).toBe(progress)
      expect(result.status).toBe("encounter")
    })

    it("none ステータスから toResult しても遷移しない", () => {
      const progress = WizEngineExplorationEventProgress.none()

      const result = progress.toResult(mockDiceResult, "体力が回復した")

      expect(result).toBe(progress)
    })

    it("result() スタティックメソッドで直接結果状態を作れる", () => {
      const progress = WizEngineExplorationEventProgress.result(
        mockEvent,
        0,
        mockDiceResult,
        "体力が回復した",
      )

      expect(progress.status).toBe("result")
      expect(progress.event).toEqual(mockEvent)
      expect(progress.choiceIndex).toBe(0)
      expect(progress.diceResult).toEqual(mockDiceResult)
      expect(progress.resultText).toBe("体力が回復した")
    })
  })

  describe("完了状態を判定できる", () => {
    it("none ステータスでは diceResult と resultText が null", () => {
      const progress = WizEngineExplorationEventProgress.none()

      expect(progress.diceResult).toBeNull()
      expect(progress.resultText).toBeNull()
    })

    it("encounter ステータスでは diceResult と resultText が null", () => {
      const progress = WizEngineExplorationEventProgress.encounter(mockEvent)

      expect(progress.diceResult).toBeNull()
      expect(progress.resultText).toBeNull()
    })

    it("result ステータスでは diceResult と resultText が取得できる", () => {
      const progress = WizEngineExplorationEventProgress.result(
        mockEvent,
        0,
        mockDiceResult,
        "体力が回復した",
      )

      expect(progress.diceResult).not.toBeNull()
      expect(progress.resultText).not.toBeNull()
    })

    it("toPlain() で内部状態をプレーンオブジェクトとして取得できる", () => {
      const progress = WizEngineExplorationEventProgress.result(
        mockEvent,
        0,
        mockDiceResult,
        "体力が回復した",
      )
      const plain = progress.toPlain()

      expect(plain.status).toBe("result")
      expect(plain).toEqual({
        status: "result",
        event: mockEvent,
        choiceIndex: 0,
        diceResult: mockDiceResult,
        resultText: "体力が回復した",
      })
    })

    it("インスタンスは Object.freeze されている", () => {
      const progress = WizEngineExplorationEventProgress.none()

      expect(Object.isFrozen(progress)).toBe(true)
    })

    it("入力eventとdice resultを所有して外部変更を遮断する", () => {
      const event = { ...structuredClone(mockEvent) }
      const dice = [4, 5] as [number, number]
      const diceResult: WizSkillCheckResult = {
        ...mockDiceResult,
        dice,
      }
      const progress = WizEngineExplorationEventProgress.result(event, 0, diceResult, "Found")

      event.description = "Changed"
      dice[0] = 6

      expect(progress.event?.description).toBe("森の中で光る泉を見つけた")
      expect(progress.diceResult?.dice).toEqual([4, 5])
      expect(Object.isFrozen(progress.event?.choices)).toBe(true)
      expect(Object.isFrozen(progress.diceResult?.dice)).toBe(true)
    })
  })
})
