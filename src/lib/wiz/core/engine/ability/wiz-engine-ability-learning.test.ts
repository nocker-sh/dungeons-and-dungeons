import { describe, expect, it } from "vite-plus/test"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WizEngineAbilityLearning } from "@/lib/wiz/core/engine/ability/wiz-engine-ability-learning"

const abilityTable = [
  { abilityId: "heal", requiredLevel: 2 },
  { abilityId: "powerStrike", requiredLevel: 3 },
  { abilityId: "quickSlash", requiredLevel: 4 },
  { abilityId: "fireball", requiredLevel: 5 },
  { abilityId: "bravery", requiredLevel: 5 },
] as const

const acquisition = new WizEngineAbilityLearning(abilityTable)

describe("getNewAbilities", () => {
  it("レベルに応じた新規スキルを取得できる", () => {
    const result = acquisition.getNewAbilities(3, [])

    expect(result).toContain("heal")
    expect(result).toContain("powerStrike")
    expect(result).not.toContain("quickSlash")
    expect(result).not.toContain("fireball")
    expect(result).toHaveLength(2)
  })

  it("既に取得済みのスキルは重複しない", () => {
    const result = acquisition.getNewAbilities(5, ["heal", "powerStrike"])

    expect(result).not.toContain("heal")
    expect(result).not.toContain("powerStrike")
    expect(result).toContain("quickSlash")
    expect(result).toContain("fireball")
    expect(result).toContain("bravery")
    expect(result).toHaveLength(3)
  })

  it("対応するレベルのスキルがない場合は空配列を返す", () => {
    const result = acquisition.getNewAbilities(1, [])

    expect(result).toHaveLength(0)
  })

  it("全スキル取得済みの場合は空配列を返す", () => {
    const allAbilityIds = abilityTable.map((e) => e.abilityId)
    const result = acquisition.getNewAbilities(10, allAbilityIds)

    expect(result).toHaveLength(0)
  })

  it("入力tableを所有し、結果をimmutableにする", () => {
    const source = [{ abilityId: "spark", requiredLevel: 2 }]
    const service = new WizEngineAbilityLearning(source)
    source[0].requiredLevel = 99
    source.push({ abilityId: "later", requiredLevel: 1 })

    const result = service.getNewAbilities(2, [])

    expect(result).toEqual(["spark"])
    expect(Object.isFrozen(result)).toBe(true)
  })
})

describe("applyNewAbilities", () => {
  it("vault にスキルが追加される", () => {
    const vault = MOCK_VAULT
    const initialAbilityCount = vault.player.abilityIds.length

    const newVault = acquisition.applyNewAbilities(vault, ["heal", "powerStrike"])

    expect(newVault.player.abilityIds).toContain("heal")
    expect(newVault.player.abilityIds).toContain("powerStrike")
    expect(newVault.player.abilityIds.length).toBe(initialAbilityCount + 2)
  })

  it("空のスキルリストでは vault が変更されない", () => {
    const vault = MOCK_VAULT

    const newVault = acquisition.applyNewAbilities(vault, [])

    expect(newVault.player.abilityIds).toEqual(vault.player.abilityIds)
  })
})
