import { describe, expect, it } from "vite-plus/test"
import { seededRandom } from "@/lib/wiz/testing/seeded-random"

describe("種つきの乱数（seededRandom）", () => {
  it("同じ種なら同じ並びになる", () => {
    const first = seededRandom(7)
    const second = seededRandom(7)
    const take = (random: () => number) =>
      Array.from({ length: 5 }, () => random())
    expect(take(first)).toEqual(take(second))
  })

  it("違う種では並びが変わる", () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)())
  })

  it("0以上1未満に収まる", () => {
    const random = seededRandom(42)
    for (let run = 0; run < 500; run++) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})
