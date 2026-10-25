import { describe, expect, it } from "vite-plus/test"
import {
  aContent,
  contentId,
  realContent,
  SequenceRandom,
  seededRandom,
} from "@/lib/wiz/testing"
import { ExpeditionRules, GameCatalog } from "@/lib/wiz"

/** 地点の出来事の抽選（ExpeditionRules）の境界と分布をさがす。 */
describe("地点の出来事の抽選", () => {
  const catalog = new GameCatalog(realContent())
  const rules = new ExpeditionRules(catalog)
  const layer = catalog.layer(contentId("layer0"))!
  const stationOf = (id: string) =>
    layer.stations.find((station) => station.id === id)!
  /** 重みから決まる出来事の割合（battle・treasure・trap）。 */
  const shareOf = (kind: "battle" | "treasure" | "trap") => {
    const { battle, treasure, trap } = layer.weights
    return layer.weights[kind] / (battle + treasure + trap)
  }

  it("[feature:W002] 終点はボス、決めた出来事の地点はその出来事。どちらも乱数を使わない", () => {
    const random = new SequenceRandom([0.9])
    const last = layer.stations.find((station) => station.boss)!
    const fixed = layer.stations.find((station) => station.event === "battle")!
    expect(rules.draw(layer, last, random.next)).toBe("boss")
    expect(rules.draw(layer, fixed, random.next)).toBe("battle")
    expect(random.used).toBe(0)
  })

  it("[feature:W002] 重みの境目で出来事が変わる", () => {
    const station = stationOf("n4")
    const toTreasure = shareOf("battle")
    const toTrap = toTreasure + shareOf("treasure")
    const step = 0.001
    for (const [value, kind] of [
      [0, "battle"],
      [toTreasure - step, "battle"],
      [toTreasure, "treasure"],
      [toTrap - step, "treasure"],
      [toTrap, "trap"],
      [0.999, "trap"],
    ] as const)
      expect([value, rules.draw(layer, station, () => value)]).toEqual([
        value,
        kind,
      ])
  })

  it("[feature:W002] 出来事の割合はおおよそ重みどおりになる", () => {
    const station = stationOf("n4")
    const counts = {
      discovery: 0,
      battle: 0,
      treasure: 0,
      trap: 0,
      midboss: 0,
      boss: 0,
    }
    const random = seededRandom(31)
    const times = 3000
    for (let step = 0; step < times; step++)
      counts[rules.draw(layer, station, random)] += 1
    expect(counts.discovery + counts.midboss + counts.boss).toBe(0)
    expect(counts.battle / times).toBeCloseTo(shareOf("battle"), 1)
    expect(counts.treasure / times).toBeCloseTo(shareOf("treasure"), 1)
    expect(counts.trap / times).toBeCloseTo(shareOf("trap"), 1)
  })

  it("[feature:W002] 出来事の重みが全部0の層は起動時に拒否する", () => {
    const content = aContent()
      .withLayer("layer0", { weights: { battle: 0, treasure: 0, trap: 0 } })
      .build()
    expect(() => new GameCatalog(content)).toThrow("出来事がない")
    // 重みが一つでもあれば抽選できる
    const one = new GameCatalog(
      aContent()
        .withLayer("layer0", { weights: { battle: 0, treasure: 0, trap: 3 } })
        .build()
    )
    const oneRules = new ExpeditionRules(one)
    const oneLayer = one.layer(contentId("layer0"))!
    const station = oneLayer.stations.find((entry) => entry.id === "n4")!
    for (const value of [0, 0.5, 0.999])
      expect(oneRules.draw(oneLayer, station, () => value)).toBe("trap")
  })

  it("[feature:W002] 宝箱の金貨は範囲に収まり、品物は層の表から1種類だけ出る", () => {
    const station = stationOf("n3")
    const goods = layer.treasure.goods.map((entry) => entry.good)
    // 金貨は深さの手当てだけ増える（終点で 1 + depth.treasure 倍）
    const factor = rules.depthFactor(
      rules.depthRatio(layer, station),
      realContent().balance.depth.treasure
    )
    const [least, most] = layer.treasure.gold
    for (const value of [0, 0.001, 0.5, 0.999]) {
      const found = rules.treasure(layer, station, () => value)
      expect(found.gold).toBeGreaterThanOrEqual(Math.round(least * factor))
      expect(found.gold).toBeLessThanOrEqual(Math.round(most * factor))
      expect(found.goods.length).toBe(1)
      expect(goods).toContain(found.goods[0].good)
      expect(found.goods[0].count).toBeGreaterThan(0)
    }
    expect(rules.treasure(layer, station, () => 0).gold).toBe(
      Math.round(least * factor)
    )
    expect(rules.treasure(layer, station, () => 0.999).gold).toBe(
      Math.round(most * factor)
    )
  })

  it("[feature:W002] 層の奥の宝にだけ、光るガラクタが確率で混ざる", () => {
    const rare = realContent().rareJunk!
    const { rareJunkFrom } = realContent().balance.depth
    for (const station of layer.stations) {
      if (station.boss) continue
      const deep = rules.depthRatio(layer, station) >= rareJunkFrom
      // 乱数0なら確率に当たり、0.999なら外れる
      const lucky = rules.treasure(layer, station, () => 0)
      const unlucky = rules.treasure(layer, station, () => 0.999)
      const has = (found: typeof lucky) =>
        found.goods.some((entry) => entry.good === rare)
      expect(has(lucky), station.id).toBe(deep)
      expect(has(unlucky), station.id).toBe(false)
    }
  })

  it("[feature:W002] 品物のない層の宝箱は金貨だけになる", () => {
    const content = aContent()
      .withLayer("layer0", { treasure: { gold: [0, 0], goods: [] } })
      .build()
    const empty = new GameCatalog(content)
    const emptyRules = new ExpeditionRules(empty)
    const emptyLayer = empty.layer(contentId("layer0"))!
    const found = emptyRules.treasure(
      emptyLayer,
      emptyLayer.stations[0],
      () => 0.5
    )
    expect(found).toEqual({ gold: 0, goods: [] })
  })

  it("[feature:W002] 罠の被害はいつも範囲に収まる（境界と多くの種）", () => {
    const [min, max] = layer.trap
    expect(rules.trap(layer, () => 0)).toBe(min)
    expect(rules.trap(layer, () => 0.999)).toBe(max)
    const random = seededRandom(7)
    for (let step = 0; step < 500; step++) {
      const damage = rules.trap(layer, random)
      expect(damage).toBeGreaterThanOrEqual(min)
      expect(damage).toBeLessThanOrEqual(max)
      expect(Number.isInteger(damage)).toBe(true)
    }
  })

  it("[feature:W002] 出てくる敵は層の敵だけで、数は group の範囲に収まる", () => {
    const random = seededRandom(11)
    const [least, most] = layer.group ?? [1, 1]
    for (let step = 0; step < 200; step++) {
      const foes = rules.foes(layer, random)
      expect(foes.length).toBeGreaterThanOrEqual(least)
      expect(foes.length).toBeLessThanOrEqual(most)
      for (const foe of foes) expect(layer.foes).toContain(foe)
    }
    const content = aContent()
      .withLayer("layer0", { group: [1, 3] })
      .build()
    const grouped = new GameCatalog(content)
    const groupedRules = new ExpeditionRules(grouped)
    const groupedLayer = grouped.layer(contentId("layer0"))!
    const sizes = new Set<number>()
    for (let step = 0; step < 300; step++)
      sizes.add(groupedRules.foes(groupedLayer, random).length)
    expect([...sizes].toSorted((left, right) => left - right)).toEqual([
      1, 2, 3,
    ])
  })

  it("[feature:W001] 出撃できない疲れは exhaustedAt 以上（境界）", () => {
    const at = realContent().balance.exhaustedAt
    expect(rules.exhausted(0)).toBe(false)
    expect(rules.exhausted(at - 1)).toBe(false)
    expect(rules.exhausted(at)).toBe(true)
    expect(rules.exhausted(at + 1)).toBe(true)
  })

  it("[feature:W002] 一歩の疲れと汚れはデータの値をそのまま返す", () => {
    expect(rules.wear()).toEqual(realContent().balance.wear)
  })
})
