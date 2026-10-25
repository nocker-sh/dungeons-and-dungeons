import { describe, expect, it } from "vite-plus/test"
import { WizEngineExplorationSkillCheck } from "@/lib/wiz/core/engine/exploration/skill-check"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"

// 固定結果を返すモックダイス
const createMockDice = (roll1: number, roll2: number): WizDice => {
  return {
    roll2d6: () => ({
      rolls: [roll1, roll2],
      total: roll1 + roll2,
    }),
  } as unknown as WizDice
}

describe("check", () => {
  it("目標値以上で成功", () => {
    const dice = createMockDice(4, 4) // 合計8
    const service = new WizEngineExplorationSkillCheck(dice)

    const result = service.check(5, 0, 10) // 8 + 5 = 13 >= 10

    expect(result.success).toBe(true)
    expect(result.total).toBe(13)
    expect(result.dice).toEqual([4, 4])
  })

  it("目標値未満で失敗", () => {
    const dice = createMockDice(2, 2) // 合計4
    const service = new WizEngineExplorationSkillCheck(dice)

    const result = service.check(3, 0, 10) // 4 + 3 = 7 < 10

    expect(result.success).toBe(false)
    expect(result.total).toBe(7)
  })

  it("修正値が適用される", () => {
    const dice = createMockDice(3, 3) // 合計6
    const service = new WizEngineExplorationSkillCheck(dice)

    const result = service.check(2, 3, 10) // 6 + 2 + 3 = 11 >= 10

    expect(result.success).toBe(true)
    expect(result.total).toBe(11)
    expect(result.modifier).toBe(5) // statValue + modifier
  })

  it("ダイス12でクリティカル成功", () => {
    const dice = createMockDice(6, 6) // 合計12
    const service = new WizEngineExplorationSkillCheck(dice)

    const result = service.check(0, 0, 100) // 目標値が高くても成功

    expect(result.success).toBe(true)
    expect(result.critical).toBe(true)
  })

  it("ダイス2でファンブル", () => {
    const dice = createMockDice(1, 1) // 合計2
    const service = new WizEngineExplorationSkillCheck(dice)

    const result = service.check(10, 0, 5)

    expect(result.fumble).toBe(true)
    // 注意: ファンブルでも合計が目標値以上なら success は true
    expect(result.total).toBe(12) // 2 + 10
  })

  it("目標値を結果に含む", () => {
    const dice = createMockDice(3, 3)
    const service = new WizEngineExplorationSkillCheck(dice)

    const result = service.check(2, 0, 15)

    expect(result.targetNumber).toBe(15)
  })
})

describe("autoSuccess", () => {
  it("常に成功を返す", () => {
    const service = new WizEngineExplorationSkillCheck(new WizDice())

    const result = service.autoSuccess()

    expect(result.success).toBe(true)
    expect(result.critical).toBe(false)
    expect(result.fumble).toBe(false)
  })
})
