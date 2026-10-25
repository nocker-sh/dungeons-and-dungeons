import { describe, expect, it } from "vitest"
import { contentSource } from "@/lib/content/game-content"
import { growthMemberOf, heroGrowthMember, simulateGrowth } from "./growth"

describe("成長のシミュレーション", () => {
  it("ゲームの数値を持つ仲間と主人公を引ける", () => {
    const first = contentSource.party[0]
    expect(growthMemberOf(first.id)?.startLevel).toBe(first.lv)
    expect(growthMemberOf("存在しないID")).toBeUndefined()
    expect(heroGrowthMember).toBeDefined()
  })

  it("加入時の能力から始まり、必要経験値を積み上げる", () => {
    const first = contentSource.recruits[0].member
    const rows = simulateGrowth(first.id, 10, 20)
    expect(rows[0].level).toBe(first.lv)
    expect(rows[0].totalExp).toBe(0)
    expect(rows[0].stats.maxHp.average).toBe(first.stats.maxHp)
    expect(rows.at(-1)?.level).toBe(10)
    for (let index = 1; index < rows.length; index++) {
      expect(rows[index].totalExp).toBe(
        rows[index - 1].totalExp + rows[index - 1].expToNext
      )
      expect(rows[index].stats.maxHp.average).toBeGreaterThan(
        rows[index - 1].stats.maxHp.average
      )
    }
  })

  it("主人公は成長せず、計測も初期能力の一行で終了する", () => {
    const hero = contentSource.party[0]
    expect(heroGrowthMember?.grows).toBe(false)
    const rows = simulateGrowth(hero.id, 20, 200)
    expect(rows).toHaveLength(1)
    expect(rows[0].expToNext).toBe(0)
    expect(rows[0].stats.maxHp.average).toBe(hero.stats.maxHp)
  })

  it("同じ条件なら毎回同じ結果になる", () => {
    const id = contentSource.recruits[0].member.id
    expect(simulateGrowth(id, 12, 30)).toEqual(simulateGrowth(id, 12, 30))
  })
})
