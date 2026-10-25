import { describe, expect, it } from "vite-plus/test"
import { GameCatalog, PartyRules, WeaponRules } from "@/lib/wiz"
import { createGameRules } from "@/lib/wiz/definition/game-rules"
import { contentId, realContent } from "@/lib/wiz/testing"

describe("計算規則の組み立て（createGameRules）", () => {
  const catalog = new GameCatalog(realContent())

  it("渡さなければ既定の規則を一組だけ作る", () => {
    const rules = createGameRules(catalog)
    expect(rules.catalog).toBe(catalog)
    expect(rules.weapons).toBeInstanceOf(WeaponRules)
    expect(rules.party).toBeInstanceOf(PartyRules)
    expect(Object.isFrozen(rules)).toBe(true)
  })

  it("渡した規則はそのまま使い、残りだけ既定で埋める", () => {
    const weapons = new WeaponRules(catalog)
    const party = new PartyRules(catalog, weapons)
    const rules = createGameRules(catalog, { weapons, party })
    expect(rules.weapons).toBe(weapons)
    expect(rules.party).toBe(party)
    expect(rules.battle).toBeDefined()
    expect(rules.expedition).toBeDefined()
  })

  it("武器の規則を差し替えると仲間の規則もそれを使う", () => {
    class DoubleExtraPower extends WeaponRules {
      override base(good: { readonly skills?: readonly string[] }) {
        return { ...super.base(good), extraPower: 10 }
      }
    }
    const weapons = new DoubleExtraPower(catalog)
    const rules = createGameRules(catalog, { weapons })
    const weapon = rules.party.equipment.weaponOf(
      { id: contentId("hero") },
      { gear: [] }
    )
    expect(weapon?.individual.extraPower).toBe(10)
  })
})
