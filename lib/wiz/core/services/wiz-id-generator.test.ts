import { describe, expect, it } from "vite-plus/test"
import { WizIdGenerator, type WizIdSource } from "@/lib/wiz/core/services/wiz-id-generator"

const verifyIdSourceContract = (source: WizIdSource): void => {
  // @ts-expect-error ID生成callbackはreadonly。
  source.next = () => "replacement-id"

  const invalidSource = {
    next: (): string | undefined => undefined,
  }
  // @ts-expect-error ID sourceは常にstringを返す必要がある。
  const invalidPort: WizIdSource = invalidSource
  void invalidPort
}

void verifyIdSourceContract

describe("WizIdGenerator", () => {
  it("string ID sourceをそのまま利用する", () => {
    const generator = new WizIdGenerator({ source: () => "world-id" })
    const { next } = generator

    expect(next()).toBe("world-id")
    expect(Object.isFrozen(generator)).toBe(true)
  })

  it("固定IDと連番IDを決定論的に生成する", () => {
    const fixed = WizIdGenerator.fixed("fixed-id")
    const counter = WizIdGenerator.counter(4)

    expect(fixed.next()).toBe("fixed-id")
    expect(fixed.next()).toBe("fixed-id")
    expect(counter.next()).toBe("5")
    expect(counter.next()).toBe("6")
  })

  it("空IDと前後空白を拒否する", () => {
    expect(() => new WizIdGenerator({ source: () => "" }).next()).toThrow(TypeError)
    expect(() => new WizIdGenerator({ source: () => " padded " }).next()).toThrow(TypeError)
  })

  it("安全な整数でないcounter開始値を拒否する", () => {
    expect(() => WizIdGenerator.counter(Number.NaN)).toThrow(RangeError)
    expect(() => WizIdGenerator.counter(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError)
  })
})
