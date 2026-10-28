import { describe, expect, it } from "vite-plus/test"
import { createMember } from "@/lib/wiz/members/create-member"
import { starterGear } from "@/lib/wiz/members/starter-gear"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { WeaponRules } from "@/lib/wiz/rules/weapon-rules"
import { memberSchema } from "@/lib/wiz/state/state-schema"

/** 仲間と初期装備の作り方（members）の不変条件をさがす。 */
describe("仲間の作り方の不変条件", () => {
  const catalog = new GameCatalog(realContent())
  const weapons = new WeaponRules(catalog)

  it("[feature:W011] 雇ったばかりの仲間は満タン・経験値0・記録なしで、保存の形に通る", () => {
    for (const def of [
      catalog.member(contentId("alda"))!,
      catalog.member(contentId("alma"))!,
      catalog.member(contentId("luca"))!,
    ]) {
      const member = createMember(def)
      expect(member).toEqual({
        id: def.id,
        lv: def.lv,
        exp: 0,
        hp: def.stats.maxHp,
        stats: { ...def.stats },
        used: [],
        status: [],
        fatigue: 0,
        dirt: 0,
        like: 0,
      })
      expect(() => memberSchema.parse(member)).not.toThrow()
      // 定義の能力を書き換えない（写しを持つ）
      expect(member.stats).not.toBe(def.stats)
    }
  })

  it("[feature:W011] 初期装備は武器が個体つきのN、防具は個体を持たない", () => {
    const husky = memberBySlug("husky")
    const gear = starterGear(
      catalog.member(husky.id)!,
      sequentialIds("g"),
      weapons
    )
    expect(gear.map((entry) => [entry.id, entry.good])).toEqual([
      ["g-1", husky.weapon],
      ...(husky.gear ?? []).map((good, index) => [`g-${index + 2}`, good]),
    ])
    for (const entry of gear) {
      expect(entry.owner).toBe(husky.id)
      expect(entry.plus).toBe(0)
      expect(entry.progress).toBe(0)
      expect(entry.wear).toBe(0)
    }
    expect(gear[0].weapon).toEqual({
      rarity: "N",
      extraPower: 0,
      skills: catalog.good(husky.weapon!)!.skills,
    })
    expect(gear[1].weapon).toBeNull()
    // 悪魔と契約して戦う仲間（R）は装備を持たずに加わる
    expect(
      starterGear(
        catalog.member(contentId("alma"))!,
        sequentialIds("g"),
        weapons
      )
    ).toEqual([])
  })

  it("[feature:W011] 武器を持たない定義の初期装備は防具だけになる", () => {
    // 主人公も募集の冒険者も、武器は持たず防具だけから始める
    for (const slug of ["hero", "luca"]) {
      const def = memberBySlug(slug)
      expect(def.weapon, slug).toBeUndefined()
      const gear = starterGear(
        catalog.member(def.id)!,
        sequentialIds("g"),
        weapons
      )
      expect(
        gear.map((entry) => entry.good),
        slug
      ).toEqual(def.gear ?? [])
    }
  })

  it("[feature:W008] 個体のワザはちょうど3つで、コンテンツにあるワザだけを指す", () => {
    for (const good of realContent().goods) {
      if (good.kind !== "weapon") continue
      const individual = weapons.forGood(catalog.good(good.id)!)!
      expect(individual.skills.length).toBe(3)
      expect(individual.rarity).toBe("N")
      expect(individual.extraPower).toBe(0)
      for (const skill of individual.skills)
        expect(catalog.skill(skill)).toBeTruthy()
    }
    expect(weapons.forGood(catalog.good(goodBySlug("leather").id)!)).toBeNull()
    expect(weapons.forGoodId("no-such-good")).toBeNull()
  })
})
