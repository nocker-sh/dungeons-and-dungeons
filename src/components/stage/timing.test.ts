import { describe, expect, it } from "vitest"
import { animationTiming, battleResultTiming, letterDelay } from "./timing"

describe("共通の演出時間", () => {
  it("長い名前も最後の文字までのずらしが上限以内", () => {
    for (const length of [1, 4, 20, 100]) {
      expect(letterDelay(length - 1, length)).toBeLessThanOrEqual(
        animationTiming.letterSpread
      )
    }
  })
  it("最後の相手のHP更新と退場が済むまで手番を進めない", () => {
    for (const targets of [1, 2, 4]) {
      const timing = battleResultTiming(targets)
      const last = (targets - 1) * animationTiming.stagger
      expect(timing.hpAt).toBe(animationTiming.impact + animationTiming.damage)
      expect(timing.duration).toBeGreaterThan(
        last + timing.hpAt + animationTiming.hp
      )
      expect(timing.duration).toBeGreaterThan(
        last + timing.hpAt + animationTiming.knockout
      )
    }
  })
  it("HPを出さず倒れない敵には、被害の数字を見せ終えるまでを待つ", () => {
    const timing = battleResultTiming(1, 0, { hp: false, knockout: false })
    expect(timing.duration).toBe(
      animationTiming.impact +
        animationTiming.number +
        animationTiming.resultPause
    )
    expect(timing.duration).toBeLessThan(battleResultTiming(1).duration)
  })
  it("状態異常や防具の後に出る数字の完了も待つ", () => {
    for (const delay of [220, 300, 500]) {
      expect(battleResultTiming(4, delay).duration).toBeGreaterThan(
        3 * animationTiming.stagger + delay + animationTiming.number
      )
    }
  })
})
