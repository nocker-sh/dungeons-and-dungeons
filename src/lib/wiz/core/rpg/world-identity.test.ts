import { describe, expect, it } from "vite-plus/test"
import { WizRpgWorldIdentity } from "@/lib/wiz/core/rpg/world-identity"

describe("WizRpgWorldIdentity", () => {
  it("canonical manifestをSHA-256 identityへ変換する", () => {
    expect(WizRpgWorldIdentity.create({}, "1").value).toBe(
      "rpg-d15d64df105603b1993a7003531add0d14620d76f5591e5e64cab99de9b9f24a",
    )
  })

  it("content、runtime revision、component revisionとidentity dataを区別する", () => {
    const base = WizRpgWorldIdentity.create({ chapters: ["one"] }, "runtime-1")

    expect(WizRpgWorldIdentity.create({ chapters: ["two"] }, "runtime-1").value).not.toBe(
      base.value,
    )
    expect(WizRpgWorldIdentity.create({ chapters: ["one"] }, "runtime-2").value).not.toBe(
      base.value,
    )
    expect(base.withComponent("feature", "reputation", "1", {}).value).not.toBe(
      base.withComponent("feature", "reputation", "2", {}).value,
    )
    expect(base.withComponent("policy", "access", "1", {}).value).not.toBe(
      base.withComponent("feature", "access", "1", {}).value,
    )
    expect(base.withComponent("feature", "reputation", "1", { tiers: ["known"] }).value).not.toBe(
      base.withComponent("feature", "reputation", "1", { tiers: ["trusted"] }).value,
    )
  })

  it("非canonical値と不正revisionを拒否する", () => {
    expect(() => WizRpgWorldIdentity.create({ value: Number.NaN }, "1")).toThrow(
      "RPG world identity requires finite numbers",
    )
    expect(() => WizRpgWorldIdentity.create({}, " ")).toThrow(
      "RPG revision must be a non-blank string",
    )
  })

  it("prototypeだけを偽装したidentityを拒否する", () => {
    const forgedIdentity = Object.freeze(Object.create(WizRpgWorldIdentity.prototype))

    expect(() => WizRpgWorldIdentity.require(forgedIdentity, "RPG scene runtime identity")).toThrow(
      "RPG scene runtime identity must be created with WizRpgWorldIdentity.create()",
    )
  })

  it("objectの挿入順に依存せず同じidentityを生成する", () => {
    const entries = Object.freeze([
      ["alpha", 1],
      ["beta", Object.freeze({ second: 2, first: 1 })],
      ["gamma", Object.freeze(["a", "b"])],
      ["delta", true],
    ] as const)
    const identities = Array.from({ length: 64 }, (_, index) => {
      const rotated = entries.map((_, offset) => entries[(index + offset) % entries.length])
      return WizRpgWorldIdentity.create(Object.fromEntries(rotated), "generated-1").value
    })

    expect(new Set(identities).size).toBe(1)
  })

  it("生成した構成の一要素差をすべて別identityとして扱う", () => {
    const identities = Array.from(
      { length: 128 },
      (_, index) =>
        WizRpgWorldIdentity.create(
          {
            chapter: Math.floor(index / 8),
            flags: [index % 2 === 0, index % 3 === 0],
            threshold: index,
          },
          "generated-1",
        ).value,
    )

    expect(new Set(identities).size).toBe(identities.length)
  })
})
