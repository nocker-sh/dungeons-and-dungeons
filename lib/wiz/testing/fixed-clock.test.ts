import { describe, expect, it } from "vite-plus/test"
import { advancingClock } from "@/lib/wiz/testing/advancing-clock"
import { fixedClock } from "@/lib/wiz/testing/fixed-clock"

describe("テスト用の時計", () => {
  it("固定の時計はいつでも同じ時刻", () => {
    const clock = fixedClock(1000)
    expect(clock()).toBe(1000)
    expect(clock()).toBe(1000)
    expect(fixedClock()()).toBe(0)
  })

  it("進む時計は呼ぶたびに step だけ増える", () => {
    const clock = advancingClock(100, 50)
    expect(clock()).toBe(100)
    expect(clock()).toBe(150)
    expect(clock()).toBe(200)
  })
})
