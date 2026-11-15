import { describe, expect, it } from "vite-plus/test"
import {
  StageDirector,
  TAKEOVER_RULES,
  stageViewOf,
  type Takeover,
} from "./director"

describe("StageDirector", () => {
  it("何も占めていなければ、すべて見せる", () => {
    expect(stageViewOf([])).toEqual({
      scene: "shown",
      chrome: "shown",
      formation: "shown",
      takeovers: [],
    })
  })

  it("それだけを見せる場面では、背景と中身のほかを出さない", () => {
    expect(stageViewOf(["solo"])).toMatchObject({
      scene: "hidden",
      chrome: "hidden",
      formation: "gone",
    })
  })

  it("会話では隊列を下げ、戻るを引っ込める", () => {
    expect(stageViewOf(["conversation"])).toMatchObject({
      scene: "shown",
      chrome: "leaving",
      formation: "lowered",
    })
  })

  it("バッグでは札を畳み、共通UIは残す", () => {
    expect(stageViewOf(["bag"])).toMatchObject({
      chrome: "shown",
      formation: "folded",
    })
  })

  it("重なったときは面ごとに強いほうを採り、順番に左右されない", () => {
    const all = Object.keys(TAKEOVER_RULES) as Takeover[]
    for (const a of all)
      for (const b of all) {
        const ab = stageViewOf([a, b])
        const ba = stageViewOf([b, a])
        expect({ ...ab, takeovers: [] }).toEqual({ ...ba, takeovers: [] })
      }
    expect(stageViewOf(["bag", "conversation"])).toMatchObject({
      chrome: "leaving",
      formation: "folded",
    })
    expect(stageViewOf(["list", "solo"])).toMatchObject({
      chrome: "hidden",
      formation: "gone",
    })
  })

  it("外すと元に戻り、同じものを重ねたら全部外すまで残る", () => {
    const director = new StageDirector()
    const first = director.enter("solo")
    const second = director.enter("solo")
    first()
    expect(director.snapshot().scene).toBe("hidden")
    second()
    expect(director.snapshot().scene).toBe("shown")
  })

  it("外す関数を二度呼んでも、ほかの登録を外さない", () => {
    const director = new StageDirector()
    const conversation = director.enter("conversation")
    const solo = director.enter("solo")
    solo()
    solo()
    expect(director.snapshot().formation).toBe("lowered")
    conversation()
    expect(director.snapshot().formation).toBe("shown")
  })

  it("見せ方が変わったときだけ知らせ、変わらない間は同じ値を返す", () => {
    const director = new StageDirector()
    let calls = 0
    director.subscribe(() => calls++)
    const before = director.snapshot()
    const leave = director.enter("bag")
    expect(calls).toBe(1)
    const during = director.snapshot()
    const again = director.enter("bag")
    expect(calls).toBe(1)
    expect(director.snapshot()).toBe(during)
    again()
    leave()
    expect(calls).toBe(2)
    expect(director.snapshot()).toEqual(before)
  })
})
