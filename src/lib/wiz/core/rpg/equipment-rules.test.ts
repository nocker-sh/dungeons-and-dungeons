import { describe, expect, it } from "vite-plus/test"
import { WizEquipmentLoadout, WizInventory } from "@/lib/wiz/core/domain/values/inventory"
import { WizRpgEquipmentRules } from "@/lib/wiz/core/rpg/equipment-rules"

describe("WizRpgEquipmentRules", () => {
  it("custom callbackの不正なresult shapeを成功扱いしない", () => {
    const invalidResults = [
      {
        expected: "must return an accepted or rejected result object",
        value: undefined,
      },
      {
        expected: "accepted result must have accepted true and equipment",
        value: {
          accepted: "yes",
          equipment: WizEquipmentLoadout.create(WizInventory.create({ capacity: 0 }), [] as const),
        },
      },
      {
        expected: "accepted result must have accepted true and equipment",
        value: { accepted: true },
      },
      {
        expected: "rejected result must have a stable non-blank reason",
        value: { accepted: false, reason: " PADDED " },
      },
    ] as const

    for (const invalid of invalidResults) {
      const rules = WizRpgEquipmentRules.define({
        equip: () => invalid.value as never,
        unequip: () =>
          WizRpgEquipmentRules.accept(
            WizEquipmentLoadout.create(WizInventory.create({ capacity: 0 }), [] as const),
          ),
      })

      expect(() => rules.equip(undefined as never)).toThrow(invalid.expected)
    }
  })

  it("factory resultを防御所有し、semantic reasonを検証する", () => {
    const accepted = WizRpgEquipmentRules.accept(
      WizEquipmentLoadout.create(WizInventory.create({ capacity: 0 }), ["mainHand"] as const),
    )

    expect(accepted.accepted).toBe(true)
    if (!accepted.accepted) {
      throw new Error("Expected accepted equipment result")
    }
    expect(accepted.equipment.toPlain()).toEqual({ mainHand: null })
    expect(Object.isFrozen(accepted.equipment)).toBe(true)
    expect(() => WizRpgEquipmentRules.reject(" ")).toThrow(
      "rejected result must have a stable non-blank reason",
    )
  })

  it("prototypeだけを偽装したrulesを拒否する", () => {
    const forgedRules = Object.freeze(Object.create(WizRpgEquipmentRules.prototype))

    expect(() =>
      WizRpgEquipmentRules.require(forgedRules, "WizRpgMechanics equipmentRules factory result"),
    ).toThrow(
      "WizRpgMechanics equipmentRules factory result must be created with WizRpgEquipmentRules.define() or standard()",
    )
  })
})
