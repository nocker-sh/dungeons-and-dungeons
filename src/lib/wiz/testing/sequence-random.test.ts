import { describe, expect, it } from "vite-plus/test"
import {
  SequenceRandom,
  sequenceRandom,
} from "@/lib/wiz/testing/sequence-random"

describe("台本どおりの乱数（SequenceRandom）", () => {
  it("決めた順番に返し、尽きたら fallback を返し続ける", () => {
    const random = new SequenceRandom([0.1, 0.9], 0.5)
    expect(random.next()).toBe(0.1)
    expect(random.next()).toBe(0.9)
    expect(random.next()).toBe(0.5)
    expect(random.next()).toBe(0.5)
  })

  it("既定の fallback は0", () => {
    const random = sequenceRandom([0.7])
    expect(random()).toBe(0.7)
    expect(random()).toBe(0)
  })

  it("使った数と残りが分かり、reset で最初へ戻る", () => {
    const random = new SequenceRandom([0.1, 0.2, 0.3])
    random.next()
    random.next()
    expect(random.used).toBe(2)
    expect(random.remaining).toEqual([0.3])
    random.reset()
    expect(random.used).toBe(0)
    expect(random.next()).toBe(0.1)
  })

  it("0 を値として扱う（fallback と混ぜない）", () => {
    const random = new SequenceRandom([0], 0.99)
    expect(random.next()).toBe(0)
    expect(random.next()).toBe(0.99)
  })
})
