import { describe, expect, it } from "vite-plus/test"
import { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"
import { createBattleEffect } from "@/lib/wiz/core/engine/battle/effects"

const createStatus = (hp = 50) =>
  WizBattleActorState.create({
    attributes: { attack: 15, defense: 10, speed: 8 },
    resources: {
      health: { current: hp, maximum: 50 },
      mana: { current: 20, maximum: 20 },
    },
    custom: {},
  })

const createMonster = (hp = 50) =>
  new WizBattleMonster({
    id: "monster-1",
    name: "Goblin",
    custom: {},
    status: createStatus(hp),
    effects: WizEffectSet.create(),
    groupId: "group-1",
  })

const createEffect = (type: "poison" | "paralysis" = "poison") =>
  createBattleEffect({
    instanceId: `effect-${type}`,
    effectId: type,
    source: { kind: "system", id: "monster-test" },
    name: type,
    lifetime: { type: "turns", remaining: 3 },
  })

describe("withDamage", () => {
  it("reduces hp by damage amount", () => {
    const monster = createMonster()
    const damaged = monster.withDamage(20)
    expect(damaged.status.resources.current("health")).toBe(30)
  })
})

describe("withHeal", () => {
  it("increases hp by heal amount", () => {
    const monster = createMonster(30)
    const healed = monster.withHeal(15)
    expect(healed.status.resources.current("health")).toBe(45)
  })
})

describe("withEffect", () => {
  it("adds effect to monster", () => {
    const monster = createMonster()
    const effect = createEffect()
    const withEffect = monster.withEffect(effect)
    expect(withEffect.effects.effects).toHaveLength(1)
  })
})

describe("isAlive", () => {
  it("returns true when hp > 0", () => {
    const monster = createMonster(1)
    expect(monster.isAlive()).toBe(true)
  })

  it("returns false when hp = 0", () => {
    const monster = createMonster(0)
    expect(monster.isAlive()).toBe(false)
  })
})

describe("canAct", () => {
  it("returns true when alive and no preventing effects", () => {
    const monster = createMonster()
    expect(monster.canAct()).toBe(true)
  })

  it("returns false when dead", () => {
    const monster = createMonster(0)
    expect(monster.canAct()).toBe(false)
  })

  it("returns false when paralyzed", () => {
    const monster = createMonster()
    const paralyzed = monster.withEffect(createEffect("paralysis"))
    expect(paralyzed.canAct()).toBe(false)
  })
})

describe("isDead", () => {
  it("returns true when hp = 0", () => {
    const monster = createMonster(0)
    expect(monster.isDead()).toBe(true)
  })

  it("returns false when hp > 0", () => {
    const monster = createMonster(1)
    expect(monster.isDead()).toBe(false)
  })
})

describe("groupId", () => {
  it("preserves groupId on modification", () => {
    const monster = createMonster()
    const damaged = monster.withDamage(10)
    expect(damaged.groupId).toBe("group-1")
  })
})

describe("immutability", () => {
  it("is frozen", () => {
    const monster = createMonster()
    expect(Object.isFrozen(monster)).toBe(true)
  })

  it("returns new instance on modification", () => {
    const original = createMonster()
    const modified = original.withDamage(10)
    expect(modified).not.toBe(original)
  })

  it("effectsをdefensive copyしてfreezeする", () => {
    const effect = createEffect()
    const input = [effect]
    const monster = new WizBattleMonster({
      id: "monster-1",
      name: "Goblin",
      custom: {},
      status: createStatus(),
      effects: WizEffectSet.create(input),
      groupId: "group-1",
    })

    input.length = 0

    expect(monster.effects.effects).toEqual([effect])
    expect(monster.effects.effects).not.toBe(input)
    expect(Object.isFrozen(monster.effects)).toBe(true)
  })
})
