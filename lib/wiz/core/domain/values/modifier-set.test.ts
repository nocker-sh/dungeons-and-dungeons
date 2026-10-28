import { describe, expect, it } from "vite-plus/test"
import { WizAttributeSet } from "@/lib/wiz/core/domain/values/attribute-set"
import { WizModifier, WizModifierSet } from "@/lib/wiz/core/domain/values/modifier-set"

describe("WizModifierSet", () => {
  it("priority順にmodifierを適用してbaseを変更しない", () => {
    const equipment = WizModifier.define({
      attributeId: "attack",
      id: "sword-attack",
      operation: "add",
      priority: 10,
      sourceId: "sword-1",
      value: 5,
    })
    const effect = WizModifier.define({
      attributeId: "attack",
      id: "attack-aura",
      operation: "multiply",
      priority: 20,
      sourceId: "aura-1",
      value: 2,
    })
    const base = WizAttributeSet.create({
      attack: 10,
      defense: 4,
    })
    const modifiers = WizModifierSet.create([effect, equipment])
    const derived = modifiers.derive(base)

    expect(base.value("attack")).toBe(10)
    expect(derived.value("attack")).toBe(30)
    expect(derived.value("defense")).toBe(4)
    expect(modifiers.removeSource("sword-1").derive(base).value("attack")).toBe(20)
  })

  it("modifier IDの重複を拒否する", () => {
    const modifier = WizModifier.define({
      attributeId: "speed",
      id: "speed-up",
      operation: "add",
      sourceId: "effect-1",
      value: 2,
    })

    expect(() => WizModifierSet.create([modifier, modifier])).toThrow()
  })
})
