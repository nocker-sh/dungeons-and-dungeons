import type { WizDice } from "@/lib/wiz/core/services/wiz-dice"
import type { WizSkillCheckResult } from "@/lib/wiz/core/types"

export class WizEngineExplorationSkillCheck {
  constructor(private readonly dice: WizDice) {
    Object.freeze(this)
  }

  check(statValue: number, modifier: number, targetNumber: number): WizSkillCheckResult {
    const diceResult = this.dice.roll2d6()
    const diceRoll: [number, number] = [diceResult.rolls[0], diceResult.rolls[1]]
    const diceSum = diceRoll[0] + diceRoll[1]
    const total = diceSum + statValue + modifier
    const isCritical = diceSum === 12
    const isFumble = diceSum === 2

    return {
      dice: diceRoll,
      total,
      modifier: statValue + modifier,
      targetNumber,
      success: total >= targetNumber || isCritical,
      critical: isCritical,
      fumble: isFumble,
    }
  }

  autoSuccess(): WizSkillCheckResult {
    return {
      dice: [0, 0],
      total: 0,
      modifier: 0,
      targetNumber: 0,
      success: true,
      critical: false,
      fumble: false,
    }
  }
}
