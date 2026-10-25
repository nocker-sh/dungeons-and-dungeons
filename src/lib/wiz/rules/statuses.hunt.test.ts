import { describe, expect, it } from "vite-plus/test"
import { Statuses, effectSpec, skillSpec } from "@/lib/wiz/rules"
import { aContent, contentId, skillBySlug } from "@/lib/wiz/testing"
import { GameCatalog } from "@/lib/wiz"
import type { Status } from "@/lib/wiz/state"

describe("状態とワザの仕様（hunt）", () => {
  const catalog = new GameCatalog(aContent().build())

  it("[feature:W004] かけ直すと手番は長い方にそろい、同じ状態は重ならない", () => {
    const once = Statuses.add([], "poison", 2)
    const twice = Statuses.add(once, "poison", 4)
    expect(twice).toEqual([{ kind: "poison", turns: 4 }])
    const shorter = Statuses.add(twice, "poison", 1)
    expect(shorter).toEqual([{ kind: "poison", turns: 4 }])
    const both = Statuses.add(shorter, "bind", 1)
    expect(both).toHaveLength(2)
  })

  it("[feature:W004] 付け外しは元の一覧を書き換えない", () => {
    const before = [{ kind: "poison" as const, turns: 2 }]
    const added = Statuses.add(before, "bind", 1)
    const removed = Statuses.remove(added, ["poison"])
    const ticked = Statuses.tick(added)
    expect(before).toEqual([{ kind: "poison", turns: 2 }])
    expect(added).toEqual([
      { kind: "poison", turns: 2 },
      { kind: "bind", turns: 1 },
    ])
    expect(removed).toEqual([{ kind: "bind", turns: 1 }])
    expect(ticked).toEqual([{ kind: "poison", turns: 1 }])
  })

  it("[feature:W004] 手番の終わりに残りが減り、0になった状態は消える", () => {
    const list = [
      { kind: "poison" as const, turns: 2 },
      { kind: "bind" as const, turns: 1 },
    ]
    const once = Statuses.tick(list)
    expect(once).toEqual([{ kind: "poison", turns: 1 }])
    expect(Statuses.tick(once)).toEqual([])
    expect(Statuses.tick([])).toEqual([])
  })

  it("[feature:W004] 溜めと守りの加護は手番では減らず、使うまで残る", () => {
    const list: Status[] = [
      { kind: "charge", turns: 1 },
      { kind: "protect", turns: 1 },
    ]
    let now: Status[] = list
    for (let turn = 0; turn < 10; turn++) now = Statuses.tick(now)
    expect(now).toEqual(list)
    expect(Statuses.has(now, "charge")).toBe(true)
    expect(Statuses.remove(now, ["charge", "protect"])).toEqual([])
  })

  it("[feature:W004] 持っていない状態は has で false", () => {
    expect(Statuses.has([], "poison")).toBe(false)
    expect(Statuses.has([{ kind: "bind", turns: 1 }], "poison")).toBe(false)
    expect(Statuses.remove([{ kind: "bind", turns: 1 }], [])).toEqual([
      { kind: "bind", turns: 1 },
    ])
  })

  it("[feature:W004] ワザの既定の対象は、攻撃なら敵ひとり・回復なら味方ひとり・支援なら自分", () => {
    const of = (slug: string) => skillSpec(catalog.skill(contentId(slug))!)
    expect(of("helmsplit").target).toBe("foe")
    expect(of("prayer").target).toBe("ally")
    expect(of("focus").target).toBe("self")
    // データで指定した対象はそのまま
    expect(of("whirl").target).toBe("foes")
    expect(of("wall").target).toBe("allies")
  })

  it("[feature:W004] 威力のないワザは威力1として扱う", () => {
    const of = (slug: string) => skillSpec(catalog.skill(contentId(slug))!)
    const mend = skillBySlug("mend")
    const helmsplit = skillBySlug("helmsplit")
    const stitch = skillBySlug("stitch")
    expect(mend.power).toBeUndefined()
    expect(of("mend").power).toBe(1)
    expect(of("helmsplit").power).toBe(helmsplit.power)
    expect(of("mend").repair).toBe(mend.repair)
    expect(of("revival-light").revive).toBe(true)
    expect(of("stitch").status).toEqual(stitch.status)
  })

  it("[feature:W004] 道具の効果は量と対象に写される", () => {
    expect(effectSpec({ type: "heal", hp: 30 })).toMatchObject({
      kind: "heal",
      amount: 30,
      target: "ally",
    })
    expect(effectSpec({ type: "heal", hp: 999, all: true }).target).toBe(
      "allies"
    )
    expect(effectSpec({ type: "damage", amount: 40 })).toMatchObject({
      kind: "hit",
      amount: 40,
      target: "foe",
    })
    expect(effectSpec({ type: "damage", amount: 40, all: true }).target).toBe(
      "foes"
    )
    expect(effectSpec({ type: "refill", uses: 2 })).toMatchObject({
      kind: "heal",
      refill: 2,
      target: "ally",
    })
    expect(effectSpec({ type: "revive", hp: 20 })).toMatchObject({
      kind: "heal",
      amount: 20,
      revive: true,
      target: "ally",
    })
    expect(effectSpec({ type: "cure", kinds: ["poison"] })).toMatchObject({
      kind: "support",
      cure: ["poison"],
      target: "ally",
    })
  })

  it("[feature:W004] 状態をかける道具は、毒と縛りなら敵・ほかは自分が既定", () => {
    expect(
      effectSpec({ type: "status", status: { kind: "poison", turns: 3 } })
        .target
    ).toBe("foe")
    expect(
      effectSpec({ type: "status", status: { kind: "bind", turns: 1 } }).target
    ).toBe("foe")
    expect(
      effectSpec({ type: "status", status: { kind: "protect", turns: 1 } })
        .target
    ).toBe("self")
    expect(
      effectSpec({ type: "status", status: { kind: "charge", turns: 1 } })
        .target
    ).toBe("self")
    expect(
      effectSpec({
        type: "status",
        status: { kind: "protect", turns: 1 },
        target: "allies",
      }).target
    ).toBe("allies")
  })

  it("[feature:W004] 道具の効果はどれも威力1で、被害や回復の量は固定値で決まる", () => {
    for (const good of aContent().build().goods)
      if (good.kind === "item" && good.effect) {
        const spec = effectSpec(good.effect)
        expect(spec.power, good.id).toBe(1)
        if (spec.kind === "hit") expect(spec.amount, good.id).toBeGreaterThan(0)
      }
  })
})
