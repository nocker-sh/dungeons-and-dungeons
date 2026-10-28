import { describe, expect, it } from "vite-plus/test"
import { WizQuestObjectiveProgress } from "@/lib/wiz/core/domain/values/quest-objective-progress"

describe("WizQuestObjectiveProgress", () => {
  it("一致するeventだけを必要数まで記録する", () => {
    const progress = WizQuestObjectiveProgress.create({
      kind: "defeat",
      targetId: "slime",
      current: 1,
      required: 3,
    })

    const next = progress.record({
      kind: "defeat",
      targetId: "slime",
      amount: 9,
    })

    expect(next.toPlain()).toEqual({
      kind: "defeat",
      targetId: "slime",
      current: 3,
      required: 3,
    })
    expect(next.isComplete).toBe(true)
    expect(progress.current).toBe(1)
  })

  it("種類か対象が異なるeventでは同じinstanceを返す", () => {
    const progress = WizQuestObjectiveProgress.create({
      kind: "gather",
      targetId: "mushroom",
      current: 0,
      required: 2,
    })

    expect(
      progress.record({ kind: "defeat", targetId: "mushroom", amount: 1 })
    ).toBe(progress)
    expect(
      progress.record({ kind: "gather", targetId: "bone", amount: 1 })
    ).toBe(progress)
  })

  it("完了済みの目標は同じinstanceのままにする", () => {
    const progress = WizQuestObjectiveProgress.create({
      kind: "contribute",
      targetId: "territory",
      current: 8,
      required: 8,
    })

    expect(
      progress.record({ kind: "contribute", targetId: "territory", amount: 1 })
    ).toBe(progress)
  })

  it("保存値をunknownから検証して復元する", () => {
    const progress = WizQuestObjectiveProgress.fromUnknown({
      kind: "gather",
      targetId: "mushroom",
      current: 1,
      required: 2,
    })

    expect(progress.kind).toBe("gather")
    expect(progress.targetId).toBe("mushroom")
    expect(progress.current).toBe(1)
    expect(progress.required).toBe(2)
  })

  it.each([
    [{ kind: "", targetId: "slime", current: 0, required: 1 }],
    [{ kind: "defeat", targetId: " ", current: 0, required: 1 }],
    [{ kind: "defeat", targetId: "slime", current: -1, required: 1 }],
    [{ kind: "defeat", targetId: "slime", current: 2, required: 1 }],
    [{ kind: "defeat", targetId: "slime", current: 0, required: 0 }],
    [{ kind: "defeat", targetId: "slime", current: 0.5, required: 1 }],
  ])("不正なstateを拒否する", (state) => {
    expect(() => WizQuestObjectiveProgress.fromUnknown(state)).toThrow()
  })

  it.each([
    { kind: "defeat", targetId: "slime", amount: 0 },
    { kind: "defeat", targetId: "slime", amount: -1 },
    { kind: "defeat", targetId: "slime", amount: 0.5 },
  ])("不正なeventを拒否する", (event) => {
    const progress = WizQuestObjectiveProgress.create({
      kind: "defeat",
      targetId: "slime",
      current: 0,
      required: 1,
    })

    expect(() => progress.record(event)).toThrow()
  })

  it("instanceと返すplain stateを深く凍結する", () => {
    const progress = WizQuestObjectiveProgress.create({
      kind: "gather",
      targetId: "mushroom",
      current: 0,
      required: 1,
    })

    expect(Object.isFrozen(progress)).toBe(true)
    expect(Object.isFrozen(progress.toPlain())).toBe(true)
    expect(() => WizQuestObjectiveProgress.require({})).toThrow(TypeError)
    expect(() => WizQuestObjectiveProgress.require(progress)).not.toThrow()
  })
})
