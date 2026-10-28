import { describe, expect, it } from "vite-plus/test"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { seededRandom } from "@/lib/wiz/testing/seeded-random"
import { sequenceRandom } from "@/lib/wiz/testing/sequence-random"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { WeaponRules } from "@/lib/wiz/rules/weapon-rules"
import type { GameContent } from "@/lib/wiz/content/content-schema"
import type { Rarity } from "@/lib/wiz/content/constants"

const rarities = ["N", "R", "SR"] as const

describe("武器の個体の規則", () => {
  const catalog = new GameCatalog(realContent())
  const weapons = new WeaponRules(catalog)
  const table = realContent().balance.weapon.rarity

  const weaponGoods = realContent().goods.filter(
    (good) => good.kind === "weapon"
  )

  it("[feature:W010] どの武器・どのレア度でも3つのワザは重ならず、先頭1つは武器で固定", () => {
    const random = seededRandom(17)
    for (const good of weaponGoods)
      for (const rarity of rarities)
        for (let run = 0; run < 30; run++) {
          const definition = catalog.good(good.id)!
          const skills = weapons.rollSkills(definition, rarity, random)
          expect(skills, `${good.id} ${rarity}`).toHaveLength(3)
          expect(new Set(skills).size, `${good.id} ${rarity}`).toBe(3)
          expect(skills.slice(0, 1)).toEqual(definition.skills!.slice(0, 1))
          for (const id of skills.slice(1))
            expect(weapons.pool(definition)).toContain(id)
        }
  })

  it("[feature:W010] 候補がその武器のワザと重なっていても、同じワザを二つ付けない", () => {
    // 片手剣の候補を2つにし、その片方を武器の1つ目、もう片方を3つ目のワザに置く
    const uppercut = contentId("uppercut")
    const parry = contentId("parry")
    const content = {
      ...realContent(),
      weaponSkills: {
        ...realContent().weaponSkills,
        sword: [uppercut, parry],
      },
      goods: realContent().goods.map((good) =>
        good.id === contentId("sword")
          ? {
              ...good,
              skills: [uppercut, contentId("twincut"), parry],
            }
          : good
      ),
    } as GameContent
    const narrow = new GameCatalog(content)
    const rules = new WeaponRules(narrow)
    const sword = narrow.good(contentId("sword"))!
    const random = seededRandom(5)
    for (let run = 0; run < 40; run++) {
      const skills = rules.rollSkills(sword, "SR", random)
      expect(new Set(skills).size, skills.join(",")).toBe(3)
    }
  })

  it("[feature:W010] 上振れはレア度の範囲、レア度は3種のどれか", () => {
    const random = seededRandom(23)
    for (let run = 0; run < 300; run++) {
      const rarity = weapons.rollRarity(random)
      expect(rarities).toContain(rarity)
      const extra = weapons.rollExtraPower({ power: 50 }, rarity, random)
      expect(Number.isInteger(extra)).toBe(true)
      expect(extra).toBeGreaterThanOrEqual(
        Math.round(50 * table.powerRate[rarity][0])
      )
      expect(extra).toBeLessThanOrEqual(
        Math.round(50 * table.powerRate[rarity][1])
      )
    }
  })

  it("[feature:W010] 乱数が端（0と1の直前）でもレア度と上振れは範囲に収まる", () => {
    for (const value of [0, 0.0000001, 0.9999999]) {
      const random = sequenceRandom([value], value)
      const rarity = weapons.rollRarity(random)
      expect(rarities).toContain(rarity)
      for (const entry of rarities) {
        const extra = weapons.rollExtraPower({ power: 50 }, entry, random)
        expect(extra).toBeGreaterThanOrEqual(
          Math.round(50 * table.powerRate[entry][0])
        )
        expect(extra).toBeLessThanOrEqual(
          Math.round(50 * table.powerRate[entry][1])
        )
      }
    }
  })

  it("[feature:W009] 売値はレア度で下がらず、必ず1以上の整数", () => {
    for (const price of [0, 1, 2, 3, 55, 1234]) {
      let last = 0
      for (const rarity of rarities) {
        const value = weapons.sellPrice(price, rarity)
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(1)
        expect(value).toBeGreaterThanOrEqual(last)
        last = value
      }
      // レア度がない（防具）はそのまま
      expect(weapons.sellPrice(price, null)).toBe(price)
    }
  })

  it("[feature:W026] 素材の手応えはレア度の表どおりで、レア度がなければ N と同じ", () => {
    const expected = realContent().balance.unique.materialProgress
    for (const rarity of rarities)
      expect(weapons.materialProgress(rarity)).toBe(expected[rarity])
    expect(weapons.materialProgress(null)).toBe(expected.N)
  })

  it("[feature:W008] 店・鍛冶屋・素の武器の個体は N・上振れなし・武器のワザそのまま", () => {
    for (const good of weaponGoods) {
      const individual = weapons.forGood(catalog.good(good.id)!)!
      expect(individual.rarity satisfies Rarity).toBe("N")
      expect(individual.extraPower).toBe(0)
      expect(individual.skills).toEqual(good.skills)
      // 個体のワザは写しで、コンテンツの配列を共有しない
      expect(individual.skills).not.toBe(good.skills)
    }
    for (const good of realContent().goods.filter(
      (entry) => entry.kind === "armor"
    ))
      expect(weapons.forGood(catalog.good(good.id)!)).toBe(null)
    expect(weapons.forGoodId("potion")).toBe(null)
    expect(weapons.forGoodId("いない品物")).toBe(null)
  })

  it("[feature:W010] ランダムに入ったワザだけ印が付く", () => {
    const sword = catalog.good(contentId("sword"))!
    const skills = [...sword.skills!]
    for (const [index, id] of skills.entries())
      expect(weapons.isRandomSkill(sword, index, id)).toBe(index > 0)
    // 固定の2枠は、違うワザでも印を付けない（武器で固定の枠）
    const other = contentId("cross-cut")
    expect(weapons.isRandomSkill(sword, 0, other)).toBe(false)
    expect(weapons.isRandomSkill(sword, 1, other)).toBe(true)
    expect(weapons.isRandomSkill(sword, 2, other)).toBe(true)
    expect(weapons.isRandomSkill(sword, 3, other)).toBe(false)
  })
})
