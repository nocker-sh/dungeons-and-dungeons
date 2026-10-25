import { describe, expect, it } from "vite-plus/test"
import {
  WizEnginePartyLevelUp,
  WizPartyMemberGrowthNotFoundError,
  WizPartyMemberGrowthTable,
} from "@/lib/wiz/core/engine/level-up/party-level-up"
import { createWizStandardPartyMemberGrowthTable } from "@/lib/wiz/core/presets/standard-party-growth"
import type { WizVaultPartyMemberState } from "@/lib/wiz/core/vault/states/player/schema"

const createMember = (
  overrides: Partial<WizVaultPartyMemberState> = {},
): WizVaultPartyMemberState => ({
  id: "elena",
  name: "エレナ",
  classId: "healer",
  level: 1,
  hp: 35,
  maxHp: 35,
  mp: 30,
  maxMp: 30,
  attributes: {
    strength: 3,
    dexterity: 4,
    agility: 4,
    vitality: 4,
    wisdom: 8,
    charisma: 6,
  },
  abilityIds: ["heal"],
  ...overrides,
})

describe("WizEnginePartyLevelUp", () => {
  const service = new WizEnginePartyLevelUp(createWizStandardPartyMemberGrowthTable())

  describe("levelUpMember", () => {
    it("levels up healer with correct growth", () => {
      const member = createMember()
      const result = service.levelUpMember(member, 2)

      expect(result.level).toBe(2)
      expect(result.maxHp).toBe(35 + 4)
      expect(result.hp).toBe(35 + 4)
      expect(result.maxMp).toBe(30 + 4)
      expect(result.mp).toBe(30 + 4)
      expect(result.attributes.wisdom).toBe(8 + 2)
      expect(result.attributes.charisma).toBe(6 + 2)
    })

    it("levels up warrior with correct growth", () => {
      const member = createMember({
        id: "gareth",
        name: "ガレス",
        classId: "warrior",
        hp: 60,
        maxHp: 60,
        mp: 10,
        maxMp: 10,
        attributes: {
          strength: 8,
          dexterity: 5,
          agility: 4,
          vitality: 7,
          wisdom: 2,
          charisma: 3,
        },
      })
      const result = service.levelUpMember(member, 2)

      expect(result.level).toBe(2)
      expect(result.maxHp).toBe(60 + 8)
      expect(result.hp).toBe(60 + 8)
      expect(result.maxMp).toBe(10 + 1)
      expect(result.attributes.strength).toBe(8 + 2)
      expect(result.attributes.vitality).toBe(7 + 2)
    })

    it("handles multiple level gains", () => {
      const member = createMember()
      const result = service.levelUpMember(member, 4)

      expect(result.level).toBe(4)
      expect(result.maxHp).toBe(35 + 4 * 3)
      expect(result.maxMp).toBe(30 + 4 * 3)
      expect(result.attributes.wisdom).toBe(8 + 2 * 3)
    })

    it("returns same member if already at target level", () => {
      const member = createMember({ level: 5 })
      const result = service.levelUpMember(member, 5)

      expect(result).toBe(member)
    })

    it("returns same member if above target level", () => {
      const member = createMember({ level: 5 })
      const result = service.levelUpMember(member, 3)

      expect(result).toBe(member)
    })

    it("preserves abilityIds", () => {
      const member = createMember({ abilityIds: ["heal", "groupHeal"] })
      const result = service.levelUpMember(member, 2)

      expect(result.abilityIds).toEqual(["heal", "groupHeal"])
    })

    it("supports an arbitrary class ID with a partial attribute growth definition", () => {
      const customService = new WizEnginePartyLevelUp(
        new WizPartyMemberGrowthTable({
          classes: {
            chronomancer: {
              hp: 2,
              mp: 7,
              attributes: { wisdom: 4 },
            },
          },
        }),
      )
      const result = customService.levelUpMember(createMember({ classId: "chronomancer" }), 3)

      expect(result.maxHp).toBe(39)
      expect(result.maxMp).toBe(44)
      expect(result.attributes.wisdom).toBe(16)
      expect(result.attributes.strength).toBe(3)
    })

    it("uses the immutable fallback growth without retaining caller-owned values", () => {
      const fallback = {
        hp: 1,
        mp: 2,
        attributes: { charisma: 3 },
      }
      const table = new WizPartyMemberGrowthTable({ classes: {}, fallback })
      Reflect.set(fallback.attributes, "charisma", 99)
      const result = new WizEnginePartyLevelUp(table).levelUpMember(
        createMember({ classId: "wanderer" }),
        2,
      )

      expect(result.maxHp).toBe(36)
      expect(result.maxMp).toBe(32)
      expect(result.attributes.charisma).toBe(9)
      expect(Object.isFrozen(table)).toBe(true)
      expect(Object.isFrozen(table.growthFor("wanderer"))).toBe(true)
      expect(Object.isFrozen(table.growthFor("wanderer").attributes)).toBe(true)
    })

    it("rejects a class ID with no growth rule", () => {
      const customService = new WizEnginePartyLevelUp(
        new WizPartyMemberGrowthTable({ classes: {} }),
      )

      expect(() => customService.levelUpMember(createMember({ classId: "unknown" }), 2)).toThrow(
        WizPartyMemberGrowthNotFoundError,
      )
    })
  })
})
