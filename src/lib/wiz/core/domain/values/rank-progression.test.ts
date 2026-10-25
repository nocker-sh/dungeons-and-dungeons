import { describe, expect, it } from "vite-plus/test"
import { WizRankProgression } from "@/lib/wiz/core/domain/values/rank-progression"

const thresholds = [0, 3, 8, 15] as const

describe("WizRankProgression", () => {
  it.each([
    [0, 1, 3, false],
    [2, 1, 3, false],
    [3, 2, 8, false],
    [8, 3, 15, false],
    [15, 4, null, true],
    [99, 4, null, true],
  ] as const)("経験値%sをrankへ写す", (experience, rank, nextRankAt, isMaxRank) => {
    const progression = WizRankProgression.create({ experience, thresholds })

    expect(progression.rank).toBe(rank)
    expect(progression.nextRankAt).toBe(nextRankAt)
    expect(progression.isMaxRank).toBe(isMaxRank)
  })

  it("元の値を変えずに経験値を加える", () => {
    const original = WizRankProgression.create({ experience: 2, thresholds })
    const gained = original.gain(2)

    expect(original.experience).toBe(2)
    expect(original.rank).toBe(1)
    expect(gained.experience).toBe(4)
    expect(gained.rank).toBe(2)
    expect(gained.gain(0)).toBe(gained)
  })

  it("外部stateを所有し、plain stateも不変にする", () => {
    const input = { experience: 3, thresholds: [0, 3, 8] }
    const progression = WizRankProgression.fromUnknown(input)
    input.thresholds[1] = 99

    expect(progression.toPlain()).toEqual({ experience: 3, thresholds: [0, 3, 8] })
    expect(Object.isFrozen(progression)).toBe(true)
    expect(Object.isFrozen(progression.toPlain())).toBe(true)
    expect(Object.isFrozen(progression.thresholds)).toBe(true)
  })

  it.each([
    { experience: -1, thresholds },
    { experience: 0, thresholds: [] },
    { experience: 0, thresholds: [1, 3] },
    { experience: 0, thresholds: [0, 3, 3] },
    { experience: 0, thresholds: [0, 8, 3] },
  ])("不正なstateを拒否する", (state) => {
    expect(() => WizRankProgression.fromUnknown(state)).toThrow(TypeError)
  })

  it("不正な加算とsafe integer超過を拒否する", () => {
    const progression = WizRankProgression.create({
      experience: Number.MAX_SAFE_INTEGER,
      thresholds: [0],
    })

    expect(() => progression.gain(-1)).toThrow(TypeError)
    expect(() => progression.gain(0.5)).toThrow(TypeError)
    expect(() => progression.gain(1)).toThrow(TypeError)
  })

  it("偽造objectをrequireで拒否する", () => {
    expect(() => WizRankProgression.require({ experience: 0, thresholds: [0] })).toThrow(TypeError)
  })
})
