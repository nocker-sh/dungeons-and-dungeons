import { describe, expect, it } from "vite-plus/test"
import {
  WizRpgCompositionComponent,
  WizRpgCompositionManifest,
} from "@/lib/wiz/core/rpg/composition-manifest"

describe("WizRpgCompositionManifest", () => {
  it("kindで絞ったcomponentのliteral型と不変性を保つ", () => {
    const mechanics = WizRpgCompositionComponent.create(
      "mechanics",
      "mechanics",
      "1",
      Object.freeze({ mode: "custom" }),
    )
    const manifest = WizRpgCompositionManifest.create("runtime-identity", "world-identity", [
      mechanics,
    ])
    const found = manifest.find("mechanics", "mechanics")
    const kind: "mechanics" | undefined = found?.kind

    expect(kind).toBe("mechanics")
    expect(manifest.list("mechanics")).toEqual([mechanics])
    expect(Object.isFrozen(manifest.list("mechanics"))).toBe(true)
  })

  it("重複componentとprototypeだけを偽装したcomponentを拒否する", () => {
    const component = WizRpgCompositionComponent.create("preset", "preset", "1", {})
    const forged = Object.freeze(Object.create(WizRpgCompositionComponent.prototype))

    expect(() =>
      WizRpgCompositionManifest.create("runtime-identity", "world-identity", [
        component,
        component,
      ]),
    ).toThrow('Duplicate RPG composition component "preset:preset"')
    expect(() =>
      WizRpgCompositionManifest.create("runtime-identity", "world-identity", [forged]),
    ).toThrow(
      "RPG composition component at index 0 must be created with WizRpgCompositionComponent.create()",
    )
  })
})
