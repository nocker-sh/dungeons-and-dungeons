import { describe, expect, it } from "vite-plus/test"
import { WizRpgComponentIdentity } from "@/lib/wiz/core/rpg/component-identity"

describe("WizRpgComponentIdentity", () => {
  it("構成データを防御所有してcanonical digestへ変換する", () => {
    const source = {
      rules: {
        thresholds: [1, 2, 3],
      },
    }
    const identity = WizRpgComponentIdentity.create("1", source)
    const equivalent = WizRpgComponentIdentity.create("1", {
      rules: {
        thresholds: [1, 2, 3],
      },
    })

    source.rules.thresholds.push(4)

    expect(identity.digest).toBe(equivalent.digest)
    expect(identity.revision).toBe("1")
    expect(Object.isFrozen(identity)).toBe(true)
  })

  it("revisionとidentity dataに非canonical値を許可しない", () => {
    expect(() => WizRpgComponentIdentity.create(" ", {})).toThrow(
      "RPG component revision must be a non-blank string",
    )
    expect(() =>
      WizRpgComponentIdentity.create("1", {
        calculate: () => 1,
      }),
    ).toThrow("Cannot own function as immutable data")
  })

  it("prototypeだけを偽装したidentityを真正なclassとして扱わない", () => {
    const forged = Object.freeze(Object.create(WizRpgComponentIdentity.prototype))

    expect(() => WizRpgComponentIdentity.require(forged, "Test identity")).toThrow(
      "Test identity must be created with WizRpgComponentIdentity.create()",
    )
  })
})
